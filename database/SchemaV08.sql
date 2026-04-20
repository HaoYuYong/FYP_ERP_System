-- ============================================================================
-- SCHEMA V08 – SCHEMA QUALITY IMPROVEMENTS + PARTIAL DELIVERY TRACKING
--              + OWN COMPANY SETTINGS
-- ============================================================================
-- Changes from V07:
--
--   Action 1 — created_by added to purchase_request and purchase_order
--        – created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
--        – Records who originally created the document, independent of
--          printed_by (who generated the PDF).
--        – Displayed on the printed form as "Prepared by".
--        – Set once at creation time by the backend using the authenticated
--          user's UUID. Never updated after creation.
--        – Index added on both tables for fast lookup by creator.
--
--   Action 2 — movement_date added to stock_movement
--        – movement_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
--        – Records exactly when the stock movement occurred.
--        – Without this column, finding when a movement happened required
--          a JOIN to the log table — adding latency to every analytics query.
--        – Having movement_date directly on stock_movement makes all
--          time-series analytics queries (stockout trend, consumption rate,
--          reorder forecasting) clean and fast without extra joins.
--        – Index added for time-range query performance.
--
--   Action 4 — inventory.ref_cost and ref_price changed to DECIMAL(15,2)
--        – Previously declared as DECIMAL with no precision or scale,
--          which defaults to variable precision in PostgreSQL.
--        – DECIMAL(15,2) enforces 2 decimal places — consistent with
--          unit_price, discount, and line_total on purchase_order_item.
--        – Eliminates potential floating-point inconsistencies when these
--          values are used in pricing calculations or reports.
--
--   Action 5 — quantity_added added to purchase_order_item
--        – quantity_added DECIMAL NOT NULL DEFAULT 0
--        – Tracks the cumulative quantity already pushed to inventory.quantity
--          from this PO line. Prevents double-counting on partial deliveries.
--        – Stock update formula on every receipt:
--            delta            = received_quantity - quantity_added
--            inventory.qty    = inventory.qty + delta
--            quantity_added   = quantity_added + delta
--        – Each delta is also recorded as an individual stock_movement row
--          so the full partial delivery history is preserved in the ledger.
--        – outstanding = poi_quantity - received_quantity at any point.
--        – A line is fully received when received_quantity = poi_quantity.
--
--   Action 6 — company_settings table (NEW)
--        – Single-row configuration table for own company details.
--        – Stores the buyer's company information printed on the header of
--          every generated Purchase Request and Purchase Order document.
--        – Singleton design: only one row ever exists (settings_id = 1).
--          Backend always reads/writes WHERE settings_id = 1.
--        – Managed via "Company Details" button on the Purchase Management
--          page header. Users can update company_name, register_no, address,
--          city, state, country, post_code, phone, email, and website.
--        – Seeded with one empty placeholder row on schema setup so the
--          frontend always has a row to read without null-checking.
--        – Tracked in tracked_tables and covered by RLS + grants.
--
--   Action 7 — generated_po_id added to purchase_request
--        – generated_po_id UUID NULLABLE REFERENCES purchase_order(po_id)
--        – Forward reference from a PR to the PO generated from it.
--        – NULL    = PR not yet converted → Generate Status: Available (green)
--        – NOT NULL = PR already converted → Generate Status: Generated (red, blocked)
--        – Set by backend after PO is successfully created. Never changed after.
--        – Circular FK (PR → PO, PO → PR) is valid in PostgreSQL because both
--          columns are nullable. FK constraint is added via ALTER TABLE after
--          purchase_order is created to resolve the circular dependency.
--        – ON DELETE SET NULL: deleting the PO makes the PR available again.
--        – reference_no on purchase_request clarified: it is the PR's own
--          reference only. When a PO is generated from this PR, the PO starts
--          with an empty reference_no for the user to fill in independently.
--
-- All other tables, functions, sequences, RLS, and grants are
-- unchanged from V07.
-- ============================================================================

-- ==============================================
-- STEP 1: DROP EXISTING OBJECTS (CLEAN SLATE)
-- ==============================================
-- Full reset — drops all tables, sequences, and functions.
-- Running this script will wipe the entire schema and rebuild from scratch.
-- Note: auth.users (Supabase built-in) is NOT touched by this script.
-- To clear registered auth users, use Supabase dashboard → Authentication → Users.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.get_next_sequence_value CASCADE;
DROP FUNCTION IF EXISTS public.insert_user CASCADE;
DROP FUNCTION IF EXISTS public.get_record_created_at CASCADE;
DROP FUNCTION IF EXISTS public.get_record_updated_at CASCADE;

DROP TABLE IF EXISTS stock_movement        CASCADE;
DROP TABLE IF EXISTS purchase_order_item   CASCADE;
DROP TABLE IF EXISTS purchase_order        CASCADE;
DROP TABLE IF EXISTS purchase_request_item CASCADE;
DROP TABLE IF EXISTS purchase_request      CASCADE;
DROP TABLE IF EXISTS company_settings      CASCADE;
DROP TABLE IF EXISTS inventory             CASCADE;
DROP TABLE IF EXISTS contact_info          CASCADE;
DROP TABLE IF EXISTS bank_acc              CASCADE;
DROP TABLE IF EXISTS liabilities           CASCADE;
DROP TABLE IF EXISTS tax                   CASCADE;
DROP TABLE IF EXISTS customer              CASCADE;
DROP TABLE IF EXISTS supplier              CASCADE;
DROP TABLE IF EXISTS classification        CASCADE;
DROP TABLE IF EXISTS system_enum           CASCADE;
DROP TABLE IF EXISTS log                   CASCADE;
DROP TABLE IF EXISTS tracked_tables        CASCADE;
DROP TABLE IF EXISTS users                 CASCADE;
DROP TABLE IF EXISTS role                  CASCADE;

DROP SEQUENCE IF EXISTS seq_user_a;
DROP SEQUENCE IF EXISTS seq_user_m;
DROP SEQUENCE IF EXISTS seq_user_s;
DROP SEQUENCE IF EXISTS seq_pr_no;
DROP SEQUENCE IF EXISTS seq_po_no;

-- ==============================================
-- STEP 2: CREATE ROLE TABLE
-- ==============================================
CREATE TABLE role (
    role_id   SERIAL PRIMARY KEY,
    role_type VARCHAR(50) NOT NULL UNIQUE,  -- 'admin', 'manager', 'staff'
    role_code CHAR(1)     NOT NULL UNIQUE   -- 'A', 'M', 'S'
);

INSERT INTO role (role_type, role_code) VALUES
    ('admin',   'A'),
    ('manager', 'M'),
    ('staff',   'S');

-- ==============================================
-- STEP 3: CREATE SEQUENCES
-- ==============================================
CREATE SEQUENCE seq_user_a START 1;  -- Admin   display ID
CREATE SEQUENCE seq_user_m START 1;  -- Manager display ID
CREATE SEQUENCE seq_user_s START 1;  -- Staff   display ID

CREATE SEQUENCE seq_pr_no START 1;   -- PR-000001, PR-000002 ...
CREATE SEQUENCE seq_po_no START 1;   -- PO-000001, PO-000002 ...

-- ==============================================
-- STEP 4: CREATE TRACKED_TABLES LOOKUP
-- ==============================================
CREATE TABLE tracked_tables (
    table_id   SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    table_code VARCHAR(50)  NOT NULL UNIQUE
);

INSERT INTO tracked_tables (table_name, table_code) VALUES
    ('users',                 'USERS'),
    ('supplier',              'SUPPLIER'),
    ('customer',              'CUSTOMER'),
    ('tax',                   'TAX'),
    ('liabilities',           'LIABILITIES'),
    ('bank_acc',              'BANK_ACC'),
    ('contact_info',          'CONTACT_INFO'),
    ('classification',        'CLASSIFICATION'),
    ('system_enum',           'SYSTEM_ENUM'),
    ('company_settings',      'COMPANY_SETTINGS'),
    ('inventory',             'INVENTORY'),
    ('stock_movement',        'STOCK_MOVEMENT'),
    ('purchase_request',      'PURCHASE_REQUEST'),
    ('purchase_request_item', 'PURCHASE_REQUEST_ITEM'),
    ('purchase_order',        'PURCHASE_ORDER'),
    ('purchase_order_item',   'PURCHASE_ORDER_ITEM');

-- ==============================================
-- STEP 5: CREATE CENTRAL LOG TABLE (Audit Trail)
-- ==============================================
CREATE TABLE log (
    log_id       BIGSERIAL PRIMARY KEY,
    table_id     INTEGER      NOT NULL REFERENCES tracked_tables(table_id),
    record_id    VARCHAR(100) NOT NULL,
    action_type  VARCHAR(10)  NOT NULL,
    action_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    action_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_data JSONB,
    CONSTRAINT chk_log_action_type CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_log_table_record_time ON log(table_id, record_id, action_at DESC);
CREATE INDEX idx_log_action_at         ON log(action_at);
CREATE INDEX idx_log_action_by         ON log(action_by);

-- ==============================================
-- STEP 6: CREATE SYSTEM_ENUM TABLE
-- ==============================================
-- Single lookup table for all fixed-option fields system-wide.
-- Frontend calls GET /api/enums?group=<enum_group> to populate dropdowns.
-- Adding a new option = one INSERT row, no schema migration needed.
-- CHECK constraints on referencing columns remain as DB-level safety net.
--
-- Current enum_group values:
--   PR_STATUS      – valid statuses for purchase_request.status
--   PO_STATUS      – valid statuses for purchase_order.status
--   MOVEMENT_TYPE  – valid types for stock_movement.movement_type
--
CREATE TABLE system_enum (
    enum_id    SERIAL       PRIMARY KEY,
    enum_group VARCHAR(50)  NOT NULL,
    enum_code  VARCHAR(50)  NOT NULL,
    enum_label VARCHAR(100) NOT NULL,
    sort_order INTEGER      NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT true,
    CONSTRAINT uq_system_enum_group_code UNIQUE (enum_group, enum_code)
);

CREATE INDEX idx_system_enum_group     ON system_enum(enum_group);
CREATE INDEX idx_system_enum_is_active ON system_enum(is_active);

-- ── PR_STATUS ──────────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('PR_STATUS', 'draft',    'Draft',    1),  -- being filled in, not yet sent
    ('PR_STATUS', 'sent',     'Sent',     2),  -- dispatched to supplier
    ('PR_STATUS', 'received', 'Received', 3),  -- supplier acknowledged
    ('PR_STATUS', 'closed',   'Closed',   4);  -- converted to PO or cancelled

-- ── PO_STATUS ──────────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('PO_STATUS', 'draft',     'Draft',     1),  -- being prepared
    ('PO_STATUS', 'sent',      'Sent',      2),  -- dispatched to supplier
    ('PO_STATUS', 'confirmed', 'Confirmed', 3),  -- supplier confirmed fulfilment
    ('PO_STATUS', 'received',  'Received',  4),  -- goods arrived → stock update triggered
    ('PO_STATUS', 'closed',    'Closed',    5);  -- fully completed or cancelled

-- ── MOVEMENT_TYPE ──────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('MOVEMENT_TYPE', 'opening',    'Opening Balance', 1),  -- initial stock on item creation
    ('MOVEMENT_TYPE', 'po_receipt', 'PO Receipt',      2),  -- stock in from a Purchase Order
    ('MOVEMENT_TYPE', 'adjustment', 'Adjustment',      3),  -- manual correction
    ('MOVEMENT_TYPE', 'sale',       'Sale',            4),  -- stock out for a sale (future)
    ('MOVEMENT_TYPE', 'return',     'Return',          5);  -- stock back in from a return

-- ==============================================
-- STEP 7: CREATE USERS TABLE
-- ==============================================
CREATE TABLE users (
    auth_id    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name  VARCHAR(100) NOT NULL,
    display_id VARCHAR(20)  NOT NULL UNIQUE,
    role_id    INTEGER      NOT NULL REFERENCES role(role_id),
    log_id     BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_role_id    ON users(role_id);
CREATE INDEX idx_users_display_id ON users(display_id);
CREATE INDEX idx_users_log_id     ON users(log_id);

-- ==============================================
-- STEP 8: CREATE CLASSIFICATION TABLE
-- ==============================================
CREATE TABLE classification (
    classification_id          SERIAL       PRIMARY KEY,
    classification_code        VARCHAR(20)  NOT NULL UNIQUE,
    classification_title       VARCHAR(100) NOT NULL,
    classification_description TEXT,
    log_id                     BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_classification_code   ON classification(classification_code);
CREATE INDEX idx_classification_log_id ON classification(log_id);

-- ==============================================
-- STEP 9: CREATE BUSINESS TABLES
-- ==============================================

-- tax
CREATE TABLE tax (
    tax_id SERIAL PRIMARY KEY,
    BRN    VARCHAR(50),
    TIN    VARCHAR(50),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_tax_log_id ON tax(log_id);

-- liabilities
CREATE TABLE liabilities (
    liabilities_id            SERIAL PRIMARY KEY,
    credit_terms              VARCHAR(50),
    credit_limit              DECIMAL,
    allow_exceed_credit_limit BOOLEAN,
    invoice_date              DATE,
    log_id                    BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_liabilities_log_id ON liabilities(log_id);

-- bank_acc
CREATE TABLE bank_acc (
    bank_id   SERIAL PRIMARY KEY,
    bank_name VARCHAR(100),
    acc_no    VARCHAR(50),
    acc_name  VARCHAR(100),
    ref       VARCHAR(100),
    status    VARCHAR(20),
    log_id    BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_bank_acc_log_id ON bank_acc(log_id);

-- contact_info
CREATE TABLE contact_info (
    contact_id SERIAL PRIMARY KEY,
    email      VARCHAR(255),
    phone      VARCHAR(50),
    address    TEXT,
    country    VARCHAR(100),
    city       VARCHAR(100),
    state      VARCHAR(100),
    post_code  VARCHAR(20),
    log_id     BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_contact_info_log_id ON contact_info(log_id);

-- supplier
CREATE TABLE supplier (
    supplier_id     SERIAL PRIMARY KEY,
    company_name    VARCHAR(200),
    control_ac      VARCHAR(50),
    branch_name     VARCHAR(100),
    industry_name   VARCHAR(100),
    industry_code   VARCHAR(50),
    register_no_new VARCHAR(50),
    register_no_old VARCHAR(50),
    status          VARCHAR(20),
    tax_id          INTEGER REFERENCES tax(tax_id),
    bank_id         INTEGER REFERENCES bank_acc(bank_id),
    contact_id      INTEGER REFERENCES contact_info(contact_id),
    liabilities_id  INTEGER REFERENCES liabilities(liabilities_id),
    log_id          BIGINT  REFERENCES log(log_id)
);

CREATE INDEX idx_supplier_tax_id          ON supplier(tax_id);
CREATE INDEX idx_supplier_bank_id         ON supplier(bank_id);
CREATE INDEX idx_supplier_contact_id      ON supplier(contact_id);
CREATE INDEX idx_supplier_liabilities_id  ON supplier(liabilities_id);
CREATE INDEX idx_supplier_log_id          ON supplier(log_id);

-- customer
CREATE TABLE customer (
    customer_id     SERIAL PRIMARY KEY,
    company_name    VARCHAR(200),
    control_ac      VARCHAR(50),
    branch_name     VARCHAR(100),
    industry_name   VARCHAR(100),
    industry_code   VARCHAR(50),
    register_no_new VARCHAR(50),
    register_no_old VARCHAR(50),
    status          VARCHAR(20),
    tax_id          INTEGER REFERENCES tax(tax_id),
    bank_id         INTEGER REFERENCES bank_acc(bank_id),
    contact_id      INTEGER REFERENCES contact_info(contact_id),
    liabilities_id  INTEGER REFERENCES liabilities(liabilities_id),
    log_id          BIGINT  REFERENCES log(log_id)
);

CREATE INDEX idx_customer_tax_id          ON customer(tax_id);
CREATE INDEX idx_customer_bank_id         ON customer(bank_id);
CREATE INDEX idx_customer_contact_id      ON customer(contact_id);
CREATE INDEX idx_customer_liabilities_id  ON customer(liabilities_id);
CREATE INDEX idx_customer_log_id          ON customer(log_id);

-- ==============================================
-- STEP 10: CREATE INVENTORY TABLE
-- ==============================================
-- quantity    = actual live stock count
--               Updated by backend every time a stock_movement row is inserted.
--               Stockout alert fires when this value falls at or below balance_qty.
--
-- balance_qty = minimum stock threshold / reorder point
--               When quantity <= balance_qty the system flags a stockout risk.
--               Core input for the predictive analytics feature.
--
-- ACTION 4: ref_cost and ref_price changed from DECIMAL to DECIMAL(15,2)
--           to enforce 2 decimal places, consistent with all other monetary
--           columns in the schema (unit_price, discount, line_total).
--
CREATE TABLE inventory (
    item_id           SERIAL        PRIMARY KEY,
    item_name         VARCHAR(255)  NOT NULL,
    description       TEXT,
    group_id          VARCHAR(50),
    uom               VARCHAR(20),

    -- CHANGED V07→V08: DECIMAL → DECIMAL(15,2) for consistency with
    -- all other monetary columns in the schema.
    ref_cost          DECIMAL(15,2),
    ref_price         DECIMAL(15,2),

    serial_number     VARCHAR(100),
    remark_1          TEXT,
    remark_2          TEXT,
    quantity          DECIMAL       NOT NULL DEFAULT 0,
    balance_qty       DECIMAL       NOT NULL DEFAULT 0,
    classification_id INTEGER REFERENCES classification(classification_id),
    log_id            BIGINT  REFERENCES log(log_id)
);

CREATE INDEX idx_inventory_item_name          ON inventory(item_name);
CREATE INDEX idx_inventory_classification_id  ON inventory(classification_id);
CREATE INDEX idx_inventory_log_id             ON inventory(log_id);

-- ==============================================
-- STEP 11: CREATE COMPANY SETTINGS TABLE
-- ==============================================
-- Singleton configuration table for own company details.
-- Stores the buyer's information printed on the left-side header of every
-- generated Purchase Request and Purchase Order document.
--
-- Design rules:
--   – Only ONE row ever exists: settings_id = 1.
--   – Backend always reads:  SELECT * FROM company_settings WHERE settings_id = 1
--   – Backend always writes: UPDATE company_settings SET ... WHERE settings_id = 1
--   – A placeholder seed row is inserted below so the frontend always has
--     a row to read without needing null-checks on first launch.
--   – Managed via the "Company Details" button on the Purchase Management page.
--
-- How it connects to generated documents:
--   PR/PO printed header (own company — left side):
--     company_name  ← company_settings.company_name
--     register_no   ← company_settings.register_no
--     address       ← company_settings.address, city, state, country, post_code
--     phone         ← company_settings.phone
--     email         ← company_settings.email
--     website       ← company_settings.website
--
--   PR/PO printed header (supplier — right side):
--     Uses snapshot columns on purchase_request / purchase_order (already frozen).
--
CREATE TABLE company_settings (
    settings_id  SERIAL        PRIMARY KEY,

    -- Own company identity — printed at top of every PR/PO document
    company_name VARCHAR(200),

    -- Business registration number
    register_no  VARCHAR(50),

    -- Address — stored as separate fields so frontend can lay them out
    -- exactly as required on the printed form header
    address      TEXT,
    city         VARCHAR(100),
    state        VARCHAR(100),
    country      VARCHAR(100),
    post_code    VARCHAR(20),

    -- Contact information
    phone        VARCHAR(50),
    email        VARCHAR(255),

    -- Company website link (optional, shown on printed document header)
    website      VARCHAR(255),

    -- Audit trail FK — updated on every save via the Company Details panel
    log_id       BIGINT REFERENCES log(log_id)
);

-- Seed the singleton row with empty placeholders.
-- The frontend reads this row immediately on load and the user fills it in
-- via the Company Details panel before generating any documents.
INSERT INTO company_settings (
    company_name, register_no,
    address, city, state, country, post_code,
    phone, email, website,
    log_id
) VALUES (
    '', '',
    '', '', '', '', '',
    '', '', '',
    NULL
);

-- ==============================================
-- STEP 12: CREATE PURCHASE REQUEST TABLES
-- ==============================================

-- purchase_request — Header record for a Purchase Request document.
-- Sent from the buyer to a supplier listing items to be requested
-- before a formal Purchase Order is confirmed.
--
-- Supplier snapshot columns are frozen at creation time by reading from
-- supplier + contact_info tables. They do not update if the supplier
-- record is later edited — keeping all historical printed documents accurate.
--
-- ACTION 1: created_by added.
--   Records who originally created this PR document.
--   Set once at creation time by the backend using the authenticated
--   user's auth_id. Never updated after creation.
--   Displayed on the printed form as "Prepared by".
--   Distinct from printed_by (who generated the PDF) — these can be
--   different people, e.g. a staff member creates the PR but a manager
--   prints and sends it.
--
-- generated_po_id: forward reference to the PO created from this PR.
--   NULL  → PR has not been converted to a PO yet → Generate Status: Available
--   NOT NULL → PR has already been converted → Generate Status: Generated (blocked)
--   Set by backend immediately after the PO is successfully created.
--   Never updated after that — one PR maps to at most one PO.
--   ON DELETE SET NULL so if the PO is deleted the PR becomes available again.
--   Circular FK with purchase_order.pr_id is valid in PostgreSQL because
--   both columns are nullable and insertion order is:
--     1. INSERT purchase_request (generated_po_id = NULL)
--     2. INSERT purchase_order   (pr_id = this PR's id)
--     3. UPDATE purchase_request SET generated_po_id = new PO's po_id
--
CREATE TABLE purchase_request (
    pr_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number, e.g. "PR-000001"
    -- Built in backend: 'PR-' || LPAD(nextval('seq_pr_no')::text, 6, '0')
    pr_no        VARCHAR(20)  NOT NULL UNIQUE,

    -- Reference number manually typed by user (supplier's ref or internal ref).
    -- This is the PR's own reference number — separate from any PO reference_no.
    -- When a PO is generated from this PR, the PO starts with an empty reference_no
    -- so the user can enter the PO-specific reference independently.
    reference_no VARCHAR(100),

    -- Payment / delivery terms, e.g. "30 days", "Net 45 days"
    terms        VARCHAR(100),

    -- Soft FK — for traceability only. Use snapshot columns for printing.
    supplier_id              INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,

    -- ── Supplier snapshot ─────────────────────────────────────────
    -- Frozen at PR creation time. Backend reads from supplier JOIN contact_info
    -- and writes these values once. Never updated after creation.
    supplier_company_name    VARCHAR(200),  -- snapshot of supplier.company_name
    supplier_register_no     VARCHAR(50),   -- snapshot of supplier.register_no_new
    supplier_address         TEXT,          -- snapshot of contact_info.address
    supplier_phone           VARCHAR(50),   -- snapshot of contact_info.phone
    supplier_email           VARCHAR(255),  -- snapshot of contact_info.email
    -- ──────────────────────────────────────────────────────────────

    -- PR lifecycle status.
    -- Valid values sourced from system_enum WHERE enum_group = 'PR_STATUS'.
    -- CHECK constraint is a DB-level safety net alongside the enum lookup.
    status       VARCHAR(20)  NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_pr_status
            CHECK (status IN ('draft', 'sent', 'received', 'closed')),

    -- Remark / message from sender to receiver, printed on the document
    remarks      TEXT,

    -- Forward reference to the Purchase Order generated from this PR.
    -- NULL    = not yet converted → Generate Status: Available  (green)
    -- NOT NULL = already converted → Generate Status: Generated (red, blocked)
    -- Set by backend after PO is successfully created. Never changed after that.
    -- Declared here without the FK constraint first; constraint added below
    -- after purchase_order table is created (circular reference resolution).
    generated_po_id UUID,

    -- ADDED V07→V08: who originally created this PR document.
    -- Set once at creation time. Never updated after creation.
    -- Used as "Prepared by" on the printed form.
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Who last generated the PDF and when (populated at print time, not at creation)
    -- May differ from created_by if a different user prints the document.
    printed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at   TIMESTAMP WITH TIME ZONE,

    -- Audit trail FK
    log_id       BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_pr_pr_no           ON purchase_request(pr_no);
CREATE INDEX idx_pr_supplier_id     ON purchase_request(supplier_id);
CREATE INDEX idx_pr_status          ON purchase_request(status);
CREATE INDEX idx_pr_generated_po_id ON purchase_request(generated_po_id);
CREATE INDEX idx_pr_created_by      ON purchase_request(created_by);
CREATE INDEX idx_pr_printed_by      ON purchase_request(printed_by);
CREATE INDEX idx_pr_log_id          ON purchase_request(log_id);

-- -----------------------------------------------
-- purchase_request_item — Line items for a PR
-- -----------------------------------------------
-- Each row is one item being requested within a Purchase Request.
-- Printed order is determined by pri_id ASC (insertion order).
--
-- Snapshot columns (item_name, item_description, uom) are frozen at
-- line-creation time from the inventory table. They do not change if
-- inventory is later edited, keeping historical documents accurate.
--
-- item_name        = the item's identity  (inventory.item_name)
-- item_description = the printed label    (editable free text, defaults to item_name)
-- Both are stored independently so the user can customise the printed description
-- without losing the original item identity.
CREATE TABLE purchase_request_item (
    pri_id           SERIAL       PRIMARY KEY,

    -- Parent PR; cascade delete removes all lines if the PR header is deleted
    pr_id            UUID         NOT NULL REFERENCES purchase_request(pr_id) ON DELETE CASCADE,

    -- Soft reference to the inventory catalogue item.
    -- NULL allowed so users can request items not yet in the catalogue.
    -- ON DELETE SET NULL preserves this line if the inventory item is later removed.
    item_id          INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,

    -- Snapshot of inventory.item_name at line-creation time.
    -- Identifies which catalogue item this line refers to, historically stable.
    item_name        VARCHAR(255),

    -- Snapshot of item description for printing.
    -- Pre-filled from inventory.item_name when item_id is selected, but freely editable.
    -- Users can add extra notes or rephrase without affecting item_name.
    item_description TEXT         NOT NULL,

    -- Snapshot of unit of measure at line-creation time.
    -- Pre-filled from inventory.uom when item_id is selected, but freely editable.
    uom              VARCHAR(20),

    -- How many units are being requested from the supplier
    pri_quantity     DECIMAL      NOT NULL DEFAULT 1
        CONSTRAINT chk_pri_quantity CHECK (pri_quantity > 0),

    -- Audit trail FK
    log_id           BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_pri_pr_id   ON purchase_request_item(pr_id);
CREATE INDEX idx_pri_item_id ON purchase_request_item(item_id);
CREATE INDEX idx_pri_log_id  ON purchase_request_item(log_id);

-- ==============================================
-- STEP 13: CREATE PURCHASE ORDER TABLES
-- ==============================================

-- purchase_order — Header record for a Purchase Order document.
-- Sent by the buyer to confirm the trade after reviewing the supplier's quotation.
-- Optionally linked back to the originating PR (pr_id = NULL if raised directly).
--
-- Supplier snapshot columns are frozen at creation time — same rationale as
-- purchase_request. Use snapshot columns for PDF generation, never live tables.
--
-- ACTION 1: created_by added — same rationale as purchase_request.created_by.
--
CREATE TABLE purchase_order (
    po_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number, e.g. "PO-000001"
    -- Built in backend: 'PO-' || LPAD(nextval('seq_po_no')::text, 6, '0')
    po_no         VARCHAR(20)   NOT NULL UNIQUE,

    -- Reference number manually typed by user
    reference_no  VARCHAR(100),

    -- Payment terms agreed with supplier, e.g. "Net 30 days", "Net 45 days"
    terms         VARCHAR(100),

    -- Expected delivery date requested by buyer
    delivery_date DATE,

    -- Soft FK — for traceability only. Use snapshot columns for printing.
    supplier_id              INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,

    -- ── Supplier snapshot ─────────────────────────────────────────
    -- Frozen at PO creation time. Backend reads from supplier JOIN contact_info
    -- and writes these values once. Never updated after creation.
    supplier_company_name    VARCHAR(200),  -- snapshot of supplier.company_name
    supplier_register_no     VARCHAR(50),   -- snapshot of supplier.register_no_new
    supplier_address         TEXT,          -- snapshot of contact_info.address
    supplier_phone           VARCHAR(50),   -- snapshot of contact_info.phone
    supplier_email           VARCHAR(255),  -- snapshot of contact_info.email
    -- ──────────────────────────────────────────────────────────────

    -- Optional back-link to the PR this PO was raised from. NULL if raised directly.
    pr_id         UUID REFERENCES purchase_request(pr_id) ON DELETE SET NULL,

    -- PO lifecycle status.
    -- Valid values sourced from system_enum WHERE enum_group = 'PO_STATUS'.
    -- When status transitions to 'received', backend inserts stock_movement rows
    -- using received_quantity from each purchase_order_item line.
    status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_po_status
            CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'closed')),

    -- Remark / message from sender to receiver, printed on the document
    remarks       TEXT,

    -- Denormalised total = SUM of all purchase_order_item.line_total.
    -- Maintained by backend on every line item insert/update.
    total_amount  DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_po_total CHECK (total_amount >= 0),

    -- ADDED V07→V08: who originally created this PO document.
    -- Set once at creation time. Never updated after creation.
    -- Used as "Prepared by" on the printed form.
    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Who last generated the PDF and when (populated at print time, not at creation)
    -- May differ from created_by if a different user prints the document.
    printed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at    TIMESTAMP WITH TIME ZONE,

    -- Audit trail FK
    log_id        BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_po_po_no       ON purchase_order(po_no);
CREATE INDEX idx_po_supplier_id ON purchase_order(supplier_id);
CREATE INDEX idx_po_pr_id       ON purchase_order(pr_id);
CREATE INDEX idx_po_status      ON purchase_order(status);
CREATE INDEX idx_po_created_by  ON purchase_order(created_by);
CREATE INDEX idx_po_printed_by  ON purchase_order(printed_by);
CREATE INDEX idx_po_log_id      ON purchase_order(log_id);

-- ── Circular FK resolution ──────────────────────────────────────────────────
-- purchase_request.generated_po_id was declared without a FK constraint above
-- because purchase_order did not exist yet at that point.
-- Now that purchase_order exists, we add the FK here.
-- ON DELETE SET NULL: if the PO is deleted, the PR becomes Available again.
ALTER TABLE purchase_request
    ADD CONSTRAINT fk_pr_generated_po_id
    FOREIGN KEY (generated_po_id)
    REFERENCES purchase_order(po_id)
    ON DELETE SET NULL;
-- ───────────────────────────────────────────────────────────────────────────

-- -----------------------------------------------
-- purchase_order_item — Line items for a PO
-- -----------------------------------------------
-- Each row is one ordered item within a Purchase Order.
-- Extends PR items with pricing columns, received_quantity,
-- and quantity_added for accurate partial delivery tracking.
-- Printed order is determined by poi_id ASC (insertion order).
--
-- Snapshot columns (item_name, item_description, uom) are frozen at
-- line-creation time — same rationale as purchase_request_item.
--
-- item_name        = the item's identity  (inventory.item_name)
-- item_description = the printed label    (editable free text, defaults to item_name)
--
-- Partial delivery stock update formula (enforced in Node.js backend):
--   delta          = received_quantity - quantity_added
--   inventory.qty  = inventory.qty + delta
--   quantity_added = quantity_added + delta
--
-- Each delta is also recorded as a stock_movement row (movement_type = 'po_receipt')
-- so the full delivery history is preserved in the ledger.
--
-- Outstanding quantity at any point = poi_quantity - received_quantity
-- A line is fully received when    received_quantity = poi_quantity
CREATE TABLE purchase_order_item (
    poi_id            SERIAL        PRIMARY KEY,

    -- Parent PO; cascade delete removes all lines if the PO header is deleted
    po_id             UUID          NOT NULL REFERENCES purchase_order(po_id) ON DELETE CASCADE,

    -- Soft reference to the inventory catalogue item (nullable)
    item_id           INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,

    -- Snapshot of inventory.item_name at line-creation time.
    -- Identifies which catalogue item this line refers to, historically stable.
    item_name         VARCHAR(255),

    -- Snapshot of item description for printing.
    -- Pre-filled from inventory.item_name when item_id is selected, but freely editable.
    item_description  TEXT          NOT NULL,

    -- Snapshot of unit of measure at line-creation time.
    -- Pre-filled from inventory.uom when item_id is selected, but freely editable.
    uom               VARCHAR(20),

    -- How many units were ordered from the supplier (the confirmed PO quantity).
    poi_quantity      DECIMAL       NOT NULL DEFAULT 1
        CONSTRAINT chk_poi_quantity CHECK (poi_quantity > 0),

    -- How many units have arrived so far across all deliveries.
    -- Updated by the backend each time a delivery batch is recorded.
    -- outstanding = poi_quantity - received_quantity at any point.
    received_quantity DECIMAL       NOT NULL DEFAULT 0
        CONSTRAINT chk_poi_received_qty CHECK (received_quantity >= 0),

    -- Cumulative quantity already pushed into inventory.quantity from this line.
    -- Starts at 0. Updated after each stock push using the delta formula:
    --   delta          = received_quantity - quantity_added
    --   inventory.qty  = inventory.qty + delta
    --   quantity_added = quantity_added + delta
    -- Prevents double-counting when received_quantity is updated in batches.
    -- quantity_added should always equal received_quantity after each push.
    quantity_added    DECIMAL       NOT NULL DEFAULT 0
        CONSTRAINT chk_poi_qty_added CHECK (quantity_added >= 0),

    -- Price per unit as agreed with supplier from their quotation
    unit_price        DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_unit_price CHECK (unit_price >= 0),

    -- Discount on this line (absolute currency value; 0.00 = no discount).
    -- Matches the "Disc." column on the printed PO form.
    discount          DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_discount CHECK (discount >= 0),

    -- Computed line total: (poi_quantity × unit_price) − discount.
    -- Maintained by backend on every insert/update of this row.
    line_total        DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_line_total CHECK (line_total >= 0),

    -- Audit trail FK
    log_id            BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_poi_po_id   ON purchase_order_item(po_id);
CREATE INDEX idx_poi_item_id ON purchase_order_item(item_id);
CREATE INDEX idx_poi_log_id  ON purchase_order_item(log_id);

-- ==============================================
-- STEP 14: CREATE STOCK MOVEMENT TABLE
-- ==============================================
-- Full ledger of every stock change for every inventory item.
-- Source of truth for stock history and predictive analytics.
-- Placed AFTER purchase_order_item because it holds a FK to poi_id.
--
-- Relationship to inventory.quantity:
--   On every INSERT here, the backend adds quantity_change to inventory.quantity.
--   inventory.quantity = fast-read cached total
--   stock_movement     = complete historical ledger
--
-- PO receipt stock update rule (enforced in Node.js backend):
--   BEFORE purchase_order.status = 'received' : no rows created here
--   ON     status → 'received'                : backend inserts one row per
--                                               purchase_order_item line using
--                                               received_quantity (not poi_quantity)
--                                               and sets movement_type = 'po_receipt'
--
-- ACTION 2: movement_date added.
--   Records exactly when the stock movement occurred.
--   Defaults to NOW() so it is always populated automatically.
--   Having this directly on the table avoids a JOIN to the log table
--   for every time-series analytics query (stockout trend, consumption
--   rate, reorder forecasting). Critical for predictive analytics performance.
--
CREATE TABLE stock_movement (
    movement_id     BIGSERIAL PRIMARY KEY,

    -- Which inventory item this movement affects
    item_id         INTEGER     NOT NULL REFERENCES inventory(item_id) ON DELETE RESTRICT,

    -- Category of movement.
    -- Valid values sourced from system_enum WHERE enum_group = 'MOVEMENT_TYPE'.
    -- CHECK constraint is a DB-level safety net alongside the enum lookup.
    movement_type   VARCHAR(20) NOT NULL
        CONSTRAINT chk_sm_movement_type
            CHECK (movement_type IN ('opening', 'po_receipt', 'adjustment', 'sale', 'return')),

    -- ADDED V07→V08: exact timestamp when this stock movement occurred.
    -- Defaults to NOW() — set automatically by the database on every INSERT.
    -- Used as the primary time axis for all stock analytics queries.
    -- Avoids requiring a JOIN to the log table to find when a movement happened.
    movement_date   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Signed quantity change:
    --   Positive (+) = stock coming IN   (opening, po_receipt, return)
    --   Negative (-) = stock going OUT   (sale, adjustment write-down)
    quantity_change DECIMAL     NOT NULL,

    -- Snapshot of inventory.quantity BEFORE this movement was applied.
    -- Together with quantity_after, enables full history reconstruction.
    quantity_before DECIMAL     NOT NULL,

    -- Snapshot of inventory.quantity AFTER this movement was applied.
    -- Must equal quantity_before + quantity_change.
    quantity_after  DECIMAL     NOT NULL,

    -- Populated only when movement_type = 'po_receipt'.
    -- Links this stock movement to the exact PO line that triggered it.
    -- NULL for all other movement types.
    poi_id          INTEGER     REFERENCES purchase_order_item(poi_id) ON DELETE SET NULL,

    -- Free-text reason. Required by convention for 'adjustment'.
    -- Optional for other movement types.
    notes           TEXT,

    -- Audit trail FK
    log_id          BIGINT      REFERENCES log(log_id)
);

CREATE INDEX idx_sm_item_id       ON stock_movement(item_id);
CREATE INDEX idx_sm_movement_type ON stock_movement(movement_type);
CREATE INDEX idx_sm_movement_date ON stock_movement(movement_date DESC);
CREATE INDEX idx_sm_poi_id        ON stock_movement(poi_id);
CREATE INDEX idx_sm_log_id        ON stock_movement(log_id);

-- Composite index for the most common analytics query pattern:
-- "give me all movements for item X between date A and date B"
CREATE INDEX idx_sm_item_date ON stock_movement(item_id, movement_date DESC);

-- ==============================================
-- STEP 15: HELPER FUNCTIONS
-- ==============================================

-- get_record_created_at
CREATE OR REPLACE FUNCTION public.get_record_created_at(
    p_table_id  INTEGER,
    p_record_id VARCHAR
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    SELECT action_at FROM log
    WHERE table_id = p_table_id AND record_id = p_record_id AND action_type = 'INSERT'
    ORDER BY action_at DESC LIMIT 1;
$$;

-- get_record_updated_at
CREATE OR REPLACE FUNCTION public.get_record_updated_at(
    p_table_id  INTEGER,
    p_record_id VARCHAR
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
    SELECT action_at FROM log
    WHERE table_id = p_table_id AND record_id = p_record_id
      AND action_type IN ('INSERT', 'UPDATE')
    ORDER BY action_at DESC LIMIT 1;
$$;

-- get_next_sequence_value
-- Used by backend to generate pr_no / po_no document numbers.
-- Example: SELECT get_next_sequence_value('seq_pr_no') → format as 'PR-000001'
CREATE OR REPLACE FUNCTION public.get_next_sequence_value(seq_name text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE next_val bigint;
BEGIN
    EXECUTE 'SELECT nextval(' || quote_literal(seq_name) || ')' INTO next_val;
    RETURN next_val;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_sequence_value TO authenticated, anon;

-- insert_user
CREATE OR REPLACE FUNCTION public.insert_user(
    p_auth_id    UUID,
    p_email      VARCHAR,
    p_first_name VARCHAR,
    p_last_name  VARCHAR,
    p_role_code  CHAR
)
RETURNS TABLE (success BOOLEAN, message VARCHAR, user_id UUID, display_id VARCHAR)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_role_id    INTEGER;
    v_nextval    BIGINT;
    v_display_id VARCHAR(20);
    v_seq_name   VARCHAR(20);
BEGIN
    SELECT role_id INTO v_role_id FROM role WHERE role_code = p_role_code;
    IF NOT FOUND THEN
        SELECT role_id INTO v_role_id FROM role WHERE role_code = 'S';
    END IF;

    IF    p_role_code = 'A' THEN v_seq_name := 'seq_user_a';
    ELSIF p_role_code = 'M' THEN v_seq_name := 'seq_user_m';
    ELSE                         v_seq_name := 'seq_user_s';
    END IF;

    EXECUTE 'SELECT nextval(' || quote_literal(v_seq_name) || ')' INTO v_nextval;
    v_display_id := p_role_code || LPAD(v_nextval::TEXT, 4, '0');

    INSERT INTO users (auth_id, email, first_name, last_name, display_id, role_id, log_id)
    VALUES (p_auth_id, p_email, p_first_name, p_last_name, v_display_id, v_role_id, NULL)
    ON CONFLICT (auth_id) DO UPDATE SET
        email      = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name  = EXCLUDED.last_name;

    RETURN QUERY SELECT true::boolean, 'User created successfully'::varchar, p_auth_id, v_display_id;
EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT false::boolean, ('Error: '||SQLERRM)::varchar, NULL::uuid, NULL::varchar;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_user TO authenticated, service_role;

-- ==============================================
-- STEP 16: ROW LEVEL SECURITY (RLS)
-- ==============================================
ALTER TABLE users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier              ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer              ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_acc              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_info          ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification        ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_enum           ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movement        ENABLE ROW LEVEL SECURITY;
ALTER TABLE log                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request      ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_item   ENABLE ROW LEVEL SECURITY;

-- Development: allow all (replace with role-based policies before production)
CREATE POLICY "Allow all" ON users                 FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON supplier              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON customer              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tax                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON liabilities           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bank_acc              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON contact_info          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON classification        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON system_enum           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON company_settings      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON inventory             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON stock_movement        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON log                   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_request      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_request_item FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_order        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_order_item   FOR ALL USING (true) WITH CHECK (true);

-- ==============================================
-- STEP 17: GRANT PERMISSIONS
-- ==============================================

-- Sequences — user display IDs
GRANT USAGE, SELECT ON SEQUENCE seq_user_a TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_m TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_s TO postgres, authenticated, anon, service_role;

-- Sequences — document numbers
GRANT USAGE, SELECT ON SEQUENCE seq_pr_no TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_po_no TO postgres, authenticated, anon, service_role;

-- Role table (read-only)
GRANT SELECT ON public.role TO postgres, authenticated, anon, service_role;

-- Users
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Enum lookup
GRANT SELECT ON public.system_enum TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.system_enum TO authenticated;

-- Business tables
GRANT ALL ON public.supplier          TO authenticated;
GRANT ALL ON public.customer          TO authenticated;
GRANT ALL ON public.tax               TO authenticated;
GRANT ALL ON public.liabilities       TO authenticated;
GRANT ALL ON public.bank_acc          TO authenticated;
GRANT ALL ON public.contact_info      TO authenticated;
GRANT ALL ON public.classification    TO authenticated;
GRANT ALL ON public.inventory         TO authenticated;
GRANT ALL ON public.stock_movement    TO authenticated;

-- Company settings (own company — singleton read/write by all authenticated users)
GRANT SELECT, UPDATE ON public.company_settings TO authenticated;

-- Purchase tables
GRANT ALL ON public.purchase_request      TO authenticated;
GRANT ALL ON public.purchase_request_item TO authenticated;
GRANT ALL ON public.purchase_order        TO authenticated;
GRANT ALL ON public.purchase_order_item   TO authenticated;

-- Log / audit
GRANT SELECT ON public.log            TO authenticated, service_role;
GRANT INSERT ON public.log            TO service_role, authenticated;
GRANT SELECT ON public.tracked_tables TO authenticated, service_role;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.get_record_created_at   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_record_updated_at   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_user             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_sequence_value TO authenticated, anon;

-- SERIAL column sequences
GRANT USAGE ON SEQUENCE supplier_supplier_id_seq             TO authenticated;
GRANT USAGE ON SEQUENCE customer_customer_id_seq             TO authenticated;
GRANT USAGE ON SEQUENCE tax_tax_id_seq                       TO authenticated;
GRANT USAGE ON SEQUENCE liabilities_liabilities_id_seq       TO authenticated;
GRANT USAGE ON SEQUENCE bank_acc_bank_id_seq                 TO authenticated;
GRANT USAGE ON SEQUENCE contact_info_contact_id_seq          TO authenticated;
GRANT USAGE ON SEQUENCE classification_classification_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE system_enum_enum_id_seq              TO authenticated;
GRANT USAGE ON SEQUENCE company_settings_settings_id_seq     TO authenticated;
GRANT USAGE ON SEQUENCE inventory_item_id_seq                TO authenticated;
GRANT USAGE ON SEQUENCE stock_movement_movement_id_seq       TO authenticated;
GRANT USAGE ON SEQUENCE log_log_id_seq                       TO authenticated;
GRANT USAGE ON SEQUENCE tracked_tables_table_id_seq          TO authenticated;
GRANT USAGE ON SEQUENCE purchase_request_item_pri_id_seq     TO authenticated;
GRANT USAGE ON SEQUENCE purchase_order_item_poi_id_seq       TO authenticated;

-- ==============================================
-- STEP 18: VERIFY SETUP (optional queries)
-- ==============================================
-- Check all public tables
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;

-- Confirm purchase_request has created_by column
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'purchase_request' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Confirm purchase_order has created_by column
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'purchase_order' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Confirm stock_movement has movement_date column
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'stock_movement' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Confirm inventory ref_cost and ref_price are now DECIMAL(15,2)
-- SELECT column_name, data_type, numeric_precision, numeric_scale
-- FROM information_schema.columns
-- WHERE table_name = 'inventory' AND table_schema = 'public'
--   AND column_name IN ('ref_cost', 'ref_price');

-- Confirm purchase_order_item has quantity_added column
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'purchase_order_item' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Confirm company_settings singleton row exists with correct structure
-- SELECT settings_id, company_name, register_no, address, city, state,
--        country, post_code, phone, email, website
-- FROM company_settings WHERE settings_id = 1;

-- Confirm purchase_request has generated_po_id column
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'purchase_request' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Check Generate Status — PRs that have been converted to a PO
-- SELECT pr_id, pr_no, generated_po_id,
--        CASE WHEN generated_po_id IS NULL THEN 'Available' ELSE 'Generated' END AS generate_status
-- FROM purchase_request ORDER BY pr_no;

-- Confirm PR/PO sequences
-- SELECT sequencename FROM pg_sequences
-- WHERE schemaname = 'public' ORDER BY sequencename;
