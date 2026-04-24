-- ============================================================================
-- SCHEMA V09 – SALES CYCLE DOCUMENTS
-- ============================================================================
-- Changes from V08:
--
--   1. New sequences for document numbers:
--        seq_quot_no  → QUOT-000001, QUOT-000002 ...
--        seq_pi_no    → PI-000001, PI-000002   ...
--        seq_do_no    → DO-000001,   DO-000002   ...
--        seq_si_no    → SI-000001,   SI-000002   ...
--
--   2. New system_enum groups:
--        QUOT_STATUS  – statuses for quotation.status
--        PI_STATUS    – statuses for proforma_invoice.status
--        DO_STATUS    – statuses for delivery_order.status
--        SI_STATUS    – statuses for sales_invoice.status
--
--   3. quotation + quotation_item tables (NEW)
--        – Supplier sends Quotation to customer in response to customer's PR.
--        – Similar to purchase_order but references customer instead of supplier.
--        – Includes unit_price, discount, line_total, total_amount (pricing columns).
--        – Customer snapshot frozen at creation time.
--        – generated_pi_id: forward ref to proforma_invoice generated from this quotation.
--          NULL = Available, NOT NULL = Generated (blocked).
--
--   4. proforma_invoice + proforma_invoice_item tables (NEW)
--        – Supplier creates Proforma Invoice after customer sends Purchase Order,
--          generated from the Quotation that was sent to the customer.
--        – quot_id: back-link to originating quotation (nullable — can be direct).
--        – generated_do_id: forward ref to delivery_order.
--          Generation only allowed when status = 'paid'.
--        – Customer snapshot frozen at creation time.
--        – Includes unit_price, discount, line_total, total_amount (pricing columns).
--
--   5. delivery_order + delivery_order_item tables (NEW)
--        – Supplier creates Delivery Order after payment is confirmed on Proforma Invoice.
--        – pi_id: back-link to originating proforma_invoice (nullable — can be direct).
--        – generated_si_id: forward ref to sales_invoice.
--          No status condition for generating Sales Invoice from Delivery Order.
--        – Customer snapshot frozen at creation time.
--        – delivery_date: requested/actual delivery date.
--        – Includes unit_price, discount, line_total, total_amount (pricing columns).
--
--   6. sales_invoice + sales_invoice_item tables (NEW)
--        – Supplier generates Sales Invoice from a Delivery Order at any time.
--        – do_id: back-link to originating delivery_order (nullable — can be direct).
--        – Customer snapshot frozen at creation time.
--        – Includes unit_price, discount, line_total, total_amount (pricing columns).
--
-- Business flow summary:
--   Customer sends Purchase Request to Supplier
--     → Supplier sends back Quotation (no direct link to PR)
--   Customer agrees → sends Purchase Order to Supplier
--     → Supplier generates Proforma Invoice from Quotation (quot_id)
--   Proforma Invoice status transitions to 'paid'
--     → Supplier generates Delivery Order from Proforma Invoice (pi_id)
--   Delivery Order created (no status condition)
--     → Supplier generates Sales Invoice from Delivery Order (do_id)
--
-- Generate status pattern (same as purchase_request.generated_po_id):
--   quotation.generated_pi_id     NULL=Available / NOT NULL=Generated
--   proforma_invoice.generated_do_id NULL=Available / NOT NULL=Generated (paid only)
--   delivery_order.generated_si_id NULL=Available / NOT NULL=Generated
--
-- All V08 tables, functions, sequences, RLS, and grants are carried forward
-- unchanged. New items are additions only.
-- ============================================================================

-- ==============================================
-- STEP 1: DROP EXISTING OBJECTS (CLEAN SLATE)
-- ==============================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.get_next_sequence_value CASCADE;
DROP FUNCTION IF EXISTS public.insert_user CASCADE;
DROP FUNCTION IF EXISTS public.get_record_created_at CASCADE;
DROP FUNCTION IF EXISTS public.get_record_updated_at CASCADE;

-- Sales cycle tables (drop in reverse dependency order)
DROP TABLE IF EXISTS sales_invoice_item  CASCADE;
DROP TABLE IF EXISTS sales_invoice       CASCADE;
DROP TABLE IF EXISTS delivery_order_item CASCADE;
DROP TABLE IF EXISTS delivery_order      CASCADE;
DROP TABLE IF EXISTS proforma_invoice_item    CASCADE;
DROP TABLE IF EXISTS proforma_invoice         CASCADE;
DROP TABLE IF EXISTS quotation_item      CASCADE;
DROP TABLE IF EXISTS quotation           CASCADE;

-- Purchase cycle tables
DROP TABLE IF EXISTS stock_movement        CASCADE;
DROP TABLE IF EXISTS purchase_order_item   CASCADE;
DROP TABLE IF EXISTS purchase_order        CASCADE;
DROP TABLE IF EXISTS purchase_request_item CASCADE;
DROP TABLE IF EXISTS purchase_request      CASCADE;

-- Business and config tables
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

-- Sequences
DROP SEQUENCE IF EXISTS seq_user_a;
DROP SEQUENCE IF EXISTS seq_user_m;
DROP SEQUENCE IF EXISTS seq_user_s;
DROP SEQUENCE IF EXISTS seq_pr_no;
DROP SEQUENCE IF EXISTS seq_po_no;
DROP SEQUENCE IF EXISTS seq_quot_no;
DROP SEQUENCE IF EXISTS seq_pi_no;
DROP SEQUENCE IF EXISTS seq_do_no;
DROP SEQUENCE IF EXISTS seq_si_no;

-- ==============================================
-- STEP 2: CREATE ROLE TABLE
-- ==============================================
CREATE TABLE role (
    role_id   SERIAL PRIMARY KEY,
    role_type VARCHAR(50) NOT NULL UNIQUE,
    role_code CHAR(1)     NOT NULL UNIQUE
);

INSERT INTO role (role_type, role_code) VALUES
    ('admin',   'A'),
    ('manager', 'M'),
    ('staff',   'S');

-- ==============================================
-- STEP 3: CREATE SEQUENCES
-- ==============================================
-- User display ID sequences
CREATE SEQUENCE seq_user_a START 1;
CREATE SEQUENCE seq_user_m START 1;
CREATE SEQUENCE seq_user_s START 1;

-- Purchase cycle document numbers
CREATE SEQUENCE seq_pr_no   START 1;   -- PR-000001
CREATE SEQUENCE seq_po_no   START 1;   -- PO-000001

-- Sales cycle document numbers
CREATE SEQUENCE seq_quot_no START 1;   -- QUOT-000001
CREATE SEQUENCE seq_pi_no   START 1;   -- PI-000001
CREATE SEQUENCE seq_do_no   START 1;   -- DO-000001
CREATE SEQUENCE seq_si_no   START 1;   -- SI-000001

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
    ('purchase_order_item',   'PURCHASE_ORDER_ITEM'),
    ('quotation',             'QUOTATION'),
    ('quotation_item',        'QUOTATION_ITEM'),
    ('proforma_invoice',           'PROFORMA_INVOICE'),
    ('proforma_invoice_item',      'PROFORMA_INVOICE_ITEM'),
    ('delivery_order',        'DELIVERY_ORDER'),
    ('delivery_order_item',   'DELIVERY_ORDER_ITEM'),
    ('sales_invoice',         'SALES_INVOICE'),
    ('sales_invoice_item',    'SALES_INVOICE_ITEM');

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
    ('PR_STATUS', 'draft',    'Draft',    1),
    ('PR_STATUS', 'sent',     'Sent',     2),
    ('PR_STATUS', 'received', 'Received', 3),
    ('PR_STATUS', 'closed',   'Closed',   4);

-- ── PO_STATUS ──────────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('PO_STATUS', 'draft',     'Draft',     1),
    ('PO_STATUS', 'sent',      'Sent',      2),
    ('PO_STATUS', 'confirmed', 'Confirmed', 3),
    ('PO_STATUS', 'received',  'Received',  4),
    ('PO_STATUS', 'closed',    'Closed',    5);

-- ── MOVEMENT_TYPE ──────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('MOVEMENT_TYPE', 'opening',    'Opening Balance', 1),
    ('MOVEMENT_TYPE', 'po_receipt', 'PO Receipt',      2),
    ('MOVEMENT_TYPE', 'adjustment', 'Adjustment',      3),
    ('MOVEMENT_TYPE', 'sale',       'Sale',            4),
    ('MOVEMENT_TYPE', 'return',     'Return',          5);

-- ── QUOT_STATUS ────────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('QUOT_STATUS', 'draft',    'Draft',    1),  -- being prepared
    ('QUOT_STATUS', 'sent',     'Sent',     2),  -- sent to customer
    ('QUOT_STATUS', 'accepted', 'Accepted', 3),  -- customer agreed (PO received)
    ('QUOT_STATUS', 'rejected', 'Rejected', 4),  -- customer declined
    ('QUOT_STATUS', 'closed',   'Closed',   5);  -- converted to SO or expired

-- ── PI_STATUS ──────────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('PI_STATUS', 'draft',     'Draft',     1),  -- being prepared
    ('PI_STATUS', 'confirmed', 'Confirmed', 2),  -- order confirmed
    ('PI_STATUS', 'paid',      'Paid',      3),  -- payment received → DO can be generated
    ('PI_STATUS', 'closed',    'Closed',    4);  -- fully completed

-- ── DO_STATUS ──────────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('DO_STATUS', 'draft',     'Draft',     1),  -- being prepared
    ('DO_STATUS', 'sent',      'Sent',      2),  -- dispatched to customer
    ('DO_STATUS', 'delivered', 'Delivered', 3),  -- goods received by customer
    ('DO_STATUS', 'closed',    'Closed',    4);  -- fully completed

-- ── SI_STATUS ──────────────────────────────────────────────────────
INSERT INTO system_enum (enum_group, enum_code, enum_label, sort_order) VALUES
    ('SI_STATUS', 'draft',   'Draft',   1),  -- being prepared
    ('SI_STATUS', 'sent',    'Sent',    2),  -- sent to customer
    ('SI_STATUS', 'paid',    'Paid',    3),  -- customer has paid
    ('SI_STATUS', 'overdue', 'Overdue', 4),  -- payment past due date
    ('SI_STATUS', 'closed',  'Closed',  5);  -- fully settled

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
CREATE TABLE inventory (
    item_id           SERIAL        PRIMARY KEY,
    item_name         VARCHAR(255)  NOT NULL,
    description       TEXT,
    group_id          VARCHAR(50),
    uom               VARCHAR(20),
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
CREATE TABLE company_settings (
    settings_id  SERIAL        PRIMARY KEY,
    company_name VARCHAR(200),
    register_no  VARCHAR(50),
    address      TEXT,
    city         VARCHAR(100),
    state        VARCHAR(100),
    country      VARCHAR(100),
    post_code    VARCHAR(20),
    phone        VARCHAR(50),
    email        VARCHAR(255),
    website      VARCHAR(255),
    log_id       BIGINT REFERENCES log(log_id)
);

INSERT INTO company_settings (
    company_name, register_no,
    address, city, state, country, post_code,
    phone, email, website, log_id
) VALUES ('', '', '', '', '', '', '', '', '', '', NULL);

-- ==============================================
-- STEP 12: CREATE PURCHASE REQUEST TABLES
-- ==============================================

CREATE TABLE purchase_request (
    pr_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_no        VARCHAR(20)  NOT NULL UNIQUE,
    reference_no VARCHAR(100),
    terms        VARCHAR(100),
    supplier_id              INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,
    supplier_company_name    VARCHAR(200),
    supplier_register_no     VARCHAR(50),
    supplier_address         TEXT,
    supplier_phone           VARCHAR(50),
    supplier_email           VARCHAR(255),
    status       VARCHAR(20)  NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_pr_status CHECK (status IN ('draft', 'sent', 'received', 'closed')),
    remarks      TEXT,
    -- Forward ref to PO generated from this PR (NULL = Available, NOT NULL = Generated)
    generated_po_id UUID,
    created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at   TIMESTAMP WITH TIME ZONE,
    log_id       BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_pr_pr_no           ON purchase_request(pr_no);
CREATE INDEX idx_pr_supplier_id     ON purchase_request(supplier_id);
CREATE INDEX idx_pr_status          ON purchase_request(status);
CREATE INDEX idx_pr_generated_po_id ON purchase_request(generated_po_id);
CREATE INDEX idx_pr_created_by      ON purchase_request(created_by);
CREATE INDEX idx_pr_printed_by      ON purchase_request(printed_by);
CREATE INDEX idx_pr_log_id          ON purchase_request(log_id);

CREATE TABLE purchase_request_item (
    pri_id           SERIAL       PRIMARY KEY,
    pr_id            UUID         NOT NULL REFERENCES purchase_request(pr_id) ON DELETE CASCADE,
    item_id          INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,
    item_name        VARCHAR(255),
    item_description TEXT         NOT NULL,
    uom              VARCHAR(20),
    pri_quantity     DECIMAL      NOT NULL DEFAULT 1
        CONSTRAINT chk_pri_quantity CHECK (pri_quantity > 0),
    log_id           BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_pri_pr_id   ON purchase_request_item(pr_id);
CREATE INDEX idx_pri_item_id ON purchase_request_item(item_id);
CREATE INDEX idx_pri_log_id  ON purchase_request_item(log_id);

-- ==============================================
-- STEP 13: CREATE PURCHASE ORDER TABLES
-- ==============================================

CREATE TABLE purchase_order (
    po_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    po_no         VARCHAR(20)   NOT NULL UNIQUE,
    reference_no  VARCHAR(100),
    terms         VARCHAR(100),
    delivery_date DATE,
    supplier_id              INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,
    supplier_company_name    VARCHAR(200),
    supplier_register_no     VARCHAR(50),
    supplier_address         TEXT,
    supplier_phone           VARCHAR(50),
    supplier_email           VARCHAR(255),
    pr_id         UUID REFERENCES purchase_request(pr_id) ON DELETE SET NULL,
    status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_po_status CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'closed')),
    remarks       TEXT,
    total_amount  DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_po_total CHECK (total_amount >= 0),
    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at    TIMESTAMP WITH TIME ZONE,
    log_id        BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_po_po_no       ON purchase_order(po_no);
CREATE INDEX idx_po_supplier_id ON purchase_order(supplier_id);
CREATE INDEX idx_po_pr_id       ON purchase_order(pr_id);
CREATE INDEX idx_po_status      ON purchase_order(status);
CREATE INDEX idx_po_created_by  ON purchase_order(created_by);
CREATE INDEX idx_po_printed_by  ON purchase_order(printed_by);
CREATE INDEX idx_po_log_id      ON purchase_order(log_id);

-- Circular FK: purchase_request.generated_po_id → purchase_order.po_id
ALTER TABLE purchase_request
    ADD CONSTRAINT fk_pr_generated_po_id
    FOREIGN KEY (generated_po_id)
    REFERENCES purchase_order(po_id)
    ON DELETE SET NULL;

CREATE TABLE purchase_order_item (
    poi_id            SERIAL        PRIMARY KEY,
    po_id             UUID          NOT NULL REFERENCES purchase_order(po_id) ON DELETE CASCADE,
    item_id           INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,
    item_name         VARCHAR(255),
    item_description  TEXT          NOT NULL,
    uom               VARCHAR(20),
    poi_quantity      DECIMAL       NOT NULL DEFAULT 1
        CONSTRAINT chk_poi_quantity CHECK (poi_quantity > 0),
    received_quantity DECIMAL       NOT NULL DEFAULT 0
        CONSTRAINT chk_poi_received_qty CHECK (received_quantity >= 0),
    quantity_added    DECIMAL       NOT NULL DEFAULT 0
        CONSTRAINT chk_poi_qty_added CHECK (quantity_added >= 0),
    unit_price        DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_unit_price CHECK (unit_price >= 0),
    discount          DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_discount CHECK (discount >= 0),
    line_total        DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_line_total CHECK (line_total >= 0),
    log_id            BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_poi_po_id   ON purchase_order_item(po_id);
CREATE INDEX idx_poi_item_id ON purchase_order_item(item_id);
CREATE INDEX idx_poi_log_id  ON purchase_order_item(log_id);

-- ==============================================
-- STEP 14: CREATE STOCK MOVEMENT TABLE
-- ==============================================
CREATE TABLE stock_movement (
    movement_id     BIGSERIAL PRIMARY KEY,
    item_id         INTEGER     NOT NULL REFERENCES inventory(item_id) ON DELETE RESTRICT,
    movement_type   VARCHAR(20) NOT NULL
        CONSTRAINT chk_sm_movement_type
            CHECK (movement_type IN ('opening', 'po_receipt', 'adjustment', 'sale', 'return')),
    movement_date   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    quantity_change DECIMAL     NOT NULL,
    quantity_before DECIMAL     NOT NULL,
    quantity_after  DECIMAL     NOT NULL,
    poi_id          INTEGER     REFERENCES purchase_order_item(poi_id) ON DELETE SET NULL,
    notes           TEXT,
    log_id          BIGINT      REFERENCES log(log_id)
);

CREATE INDEX idx_sm_item_id       ON stock_movement(item_id);
CREATE INDEX idx_sm_movement_type ON stock_movement(movement_type);
CREATE INDEX idx_sm_movement_date ON stock_movement(movement_date DESC);
CREATE INDEX idx_sm_poi_id        ON stock_movement(poi_id);
CREATE INDEX idx_sm_log_id        ON stock_movement(log_id);
CREATE INDEX idx_sm_item_date     ON stock_movement(item_id, movement_date DESC);

-- ==============================================
-- STEP 15: CREATE QUOTATION TABLES
-- ==============================================

-- quotation — Supplier sends this to customer in response to customer's Purchase Request.
-- Not directly linked to a purchase_request (customer may send PR by other means).
-- Contains pricing columns (unit_price, discount, line_total, total_amount)
-- because a quotation is a priced offer, unlike a purchase request.
--
-- generated_pi_id: forward reference to the Proforma Invoice generated from this quotation.
--   NULL    = Available → quotation can be converted to a Proforma Invoice
--   NOT NULL = Generated → already converted, conversion blocked
--   Circular FK added via ALTER TABLE after proforma_invoice is created.
--
CREATE TABLE quotation (
    quot_id       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number: 'QUOT-' || LPAD(nextval('seq_quot_no'), 6, '0')
    quot_no       VARCHAR(20)   NOT NULL UNIQUE,

    -- Reference number manually typed by user
    reference_no  VARCHAR(100),

    -- Payment / delivery terms
    terms         VARCHAR(100),

    -- Which customer this quotation is addressed to (soft FK for traceability)
    customer_id              INTEGER REFERENCES customer(customer_id) ON DELETE SET NULL,

    -- ── Customer snapshot ──────────────────────────────────────────
    -- Frozen at quotation creation time from customer + contact_info.
    -- Used when printing the document. Never changes after creation.
    customer_company_name    VARCHAR(200),  -- snapshot of customer.company_name
    customer_register_no     VARCHAR(50),   -- snapshot of customer.register_no_new
    customer_address         TEXT,          -- snapshot of contact_info.address
    customer_phone           VARCHAR(50),   -- snapshot of contact_info.phone
    customer_email           VARCHAR(255),  -- snapshot of contact_info.email
    -- ──────────────────────────────────────────────────────────────

    -- Quotation lifecycle status.
    -- Valid values from system_enum WHERE enum_group = 'QUOT_STATUS'.
    status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_quot_status
            CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'closed')),

    -- Remark / message printed on the document
    remarks       TEXT,

    -- Denormalised total = SUM of all quotation_item.line_total
    total_amount  DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_quot_total CHECK (total_amount >= 0),

    -- Forward ref to Proforma Invoice generated from this quotation.
    -- NULL = Available (green), NOT NULL = Generated (red, blocked).
    -- Declared without FK here; FK added via ALTER TABLE after proforma_invoice is created.
    generated_pi_id UUID,

    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at    TIMESTAMP WITH TIME ZONE,
    log_id        BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_quot_quot_no        ON quotation(quot_no);
CREATE INDEX idx_quot_customer_id    ON quotation(customer_id);
CREATE INDEX idx_quot_status         ON quotation(status);
CREATE INDEX idx_quot_generated_pi_id ON quotation(generated_pi_id);
CREATE INDEX idx_quot_created_by     ON quotation(created_by);
CREATE INDEX idx_quot_log_id         ON quotation(log_id);

-- quotation_item — Line items for a Quotation.
-- Includes pricing columns because a quotation is a priced offer.
-- Printed order determined by qi_id ASC (insertion order).
CREATE TABLE quotation_item (
    qi_id            SERIAL        PRIMARY KEY,
    quot_id          UUID          NOT NULL REFERENCES quotation(quot_id) ON DELETE CASCADE,
    item_id          INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,
    item_name        VARCHAR(255),
    item_description TEXT          NOT NULL,
    uom              VARCHAR(20),
    qi_quantity      DECIMAL       NOT NULL DEFAULT 1
        CONSTRAINT chk_qi_quantity CHECK (qi_quantity > 0),
    unit_price       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_qi_unit_price CHECK (unit_price >= 0),
    discount         DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_qi_discount CHECK (discount >= 0),
    -- (qi_quantity × unit_price) − discount
    line_total       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_qi_line_total CHECK (line_total >= 0),
    log_id           BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_qi_quot_id  ON quotation_item(quot_id);
CREATE INDEX idx_qi_item_id  ON quotation_item(item_id);
CREATE INDEX idx_qi_log_id   ON quotation_item(log_id);

-- ==============================================
-- STEP 16: CREATE PROFORMA INVOICE TABLES
-- ==============================================

-- proforma_invoice — Supplier creates this after receiving customer's Purchase Order.
-- Generated from the Quotation that was sent to the customer (quot_id).
-- quot_id is nullable — a Proforma Invoice can be created directly without a prior quotation.
--
-- generated_do_id: forward reference to the Delivery Order generated from this SO.
--   NULL    = Available → SO can be converted to a Delivery Order
--   NOT NULL = Generated → already converted, blocked
--   CONDITION: generation only allowed when status = 'paid'
--   Circular FK added via ALTER TABLE after delivery_order is created.
--
CREATE TABLE proforma_invoice (
    pi_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number: 'PI-' || LPAD(nextval('seq_pi_no'), 6, '0')
    pi_no         VARCHAR(20)   NOT NULL UNIQUE,

    reference_no  VARCHAR(100),
    terms         VARCHAR(100),

    -- Which customer this SO is for (soft FK for traceability)
    customer_id              INTEGER REFERENCES customer(customer_id) ON DELETE SET NULL,

    -- ── Customer snapshot ──────────────────────────────────────────
    customer_company_name    VARCHAR(200),
    customer_register_no     VARCHAR(50),
    customer_address         TEXT,
    customer_phone           VARCHAR(50),
    customer_email           VARCHAR(255),
    -- ──────────────────────────────────────────────────────────────

    -- Back-link to the Quotation this SO was generated from.
    -- NULL if SO was created directly without a prior quotation.
    quot_id       UUID REFERENCES quotation(quot_id) ON DELETE SET NULL,

    -- Proforma Invoice lifecycle status.
    -- Valid values from system_enum WHERE enum_group = 'PI_STATUS'.
    -- Delivery Order can ONLY be generated when status = 'paid'.
    status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_pi_status
            CHECK (status IN ('draft', 'confirmed', 'paid', 'closed')),

    remarks       TEXT,

    total_amount  DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_pi_total CHECK (total_amount >= 0),

    -- Forward ref to Delivery Order generated from this SO.
    -- NULL = Available (green), NOT NULL = Generated (red, blocked).
    -- Generation only permitted when status = 'paid' (enforced in backend).
    -- Declared without FK here; FK added via ALTER TABLE after delivery_order created.
    generated_do_id UUID,

    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at    TIMESTAMP WITH TIME ZONE,
    log_id        BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_so_pi_no           ON proforma_invoice(pi_no);
CREATE INDEX idx_pi_customer_id     ON proforma_invoice(customer_id);
CREATE INDEX idx_pi_quot_id         ON proforma_invoice(quot_id);
CREATE INDEX idx_pi_status          ON proforma_invoice(status);
CREATE INDEX idx_pi_generated_do_id ON proforma_invoice(generated_do_id);
CREATE INDEX idx_pi_created_by      ON proforma_invoice(created_by);
CREATE INDEX idx_pi_log_id          ON proforma_invoice(log_id);

-- Circular FK: quotation.generated_pi_id → proforma_invoice.pi_id
ALTER TABLE quotation
    ADD CONSTRAINT fk_quot_generated_pi_id
    FOREIGN KEY (generated_pi_id)
    REFERENCES proforma_invoice(pi_id)
    ON DELETE SET NULL;

-- proforma_invoice_item — Line items for a Proforma Invoice.
CREATE TABLE proforma_invoice_item (
    pii_id           SERIAL        PRIMARY KEY,
    pi_id            UUID          NOT NULL REFERENCES proforma_invoice(pi_id) ON DELETE CASCADE,
    item_id          INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,
    item_name        VARCHAR(255),
    item_description TEXT          NOT NULL,
    uom              VARCHAR(20),
    pi_quantity      DECIMAL       NOT NULL DEFAULT 1
        CONSTRAINT chk_pii_quantity CHECK (pi_quantity > 0),
    unit_price       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_pii_unit_price CHECK (unit_price >= 0),
    discount         DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_pii_discount CHECK (discount >= 0),
    -- (pi_quantity × unit_price) − discount
    line_total       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_pii_line_total CHECK (line_total >= 0),
    log_id           BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_pii_pi_id   ON proforma_invoice_item(pi_id);
CREATE INDEX idx_pii_item_id ON proforma_invoice_item(item_id);
CREATE INDEX idx_pii_log_id  ON proforma_invoice_item(log_id);

-- ==============================================
-- STEP 17: CREATE DELIVERY ORDER TABLES
-- ==============================================

-- delivery_order — Supplier creates this after payment is confirmed on Proforma Invoice.
-- Generated from the Proforma Invoice (pi_id).
-- pi_id is nullable — can be created directly without a prior SO.
--
-- CONDITION for generation: proforma_invoice.status must be 'paid' (enforced in backend).
--
-- generated_si_id: forward reference to the Sales Invoice generated from this DO.
--   NULL    = Available → DO can be converted to a Sales Invoice at any time
--   NOT NULL = Generated → already converted, blocked
--   No status condition for generating Sales Invoice from Delivery Order.
--   Circular FK added via ALTER TABLE after sales_invoice is created.
--
CREATE TABLE delivery_order (
    do_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number: 'DO-' || LPAD(nextval('seq_do_no'), 6, '0')
    do_no         VARCHAR(20)   NOT NULL UNIQUE,

    reference_no  VARCHAR(100),
    terms         VARCHAR(100),

    -- Expected or actual delivery date
    delivery_date DATE,

    -- Which customer this DO is for (soft FK for traceability)
    customer_id              INTEGER REFERENCES customer(customer_id) ON DELETE SET NULL,

    -- ── Customer snapshot ──────────────────────────────────────────
    customer_company_name    VARCHAR(200),
    customer_register_no     VARCHAR(50),
    customer_address         TEXT,
    customer_phone           VARCHAR(50),
    customer_email           VARCHAR(255),
    -- ──────────────────────────────────────────────────────────────

    -- Back-link to the Proforma Invoice this DO was generated from.
    -- NULL if DO was created directly.
    pi_id         UUID REFERENCES proforma_invoice(pi_id) ON DELETE SET NULL,

    -- Delivery Order lifecycle status.
    -- Valid values from system_enum WHERE enum_group = 'DO_STATUS'.
    status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_do_status
            CHECK (status IN ('draft', 'sent', 'delivered', 'closed')),

    remarks       TEXT,

    total_amount  DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_do_total CHECK (total_amount >= 0),

    -- Forward ref to Sales Invoice generated from this DO.
    -- NULL = Available (green), NOT NULL = Generated (red, blocked).
    -- No status condition — invoice can be generated at any time after DO creation.
    -- Declared without FK here; FK added via ALTER TABLE after sales_invoice created.
    generated_si_id UUID,

    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at    TIMESTAMP WITH TIME ZONE,
    log_id        BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_do_do_no           ON delivery_order(do_no);
CREATE INDEX idx_do_customer_id     ON delivery_order(customer_id);
CREATE INDEX idx_do_pi_id           ON delivery_order(pi_id);
CREATE INDEX idx_do_status          ON delivery_order(status);
CREATE INDEX idx_do_generated_si_id ON delivery_order(generated_si_id);
CREATE INDEX idx_do_created_by      ON delivery_order(created_by);
CREATE INDEX idx_do_log_id          ON delivery_order(log_id);

-- Circular FK: proforma_invoice.generated_do_id → delivery_order.do_id
ALTER TABLE proforma_invoice
    ADD CONSTRAINT fk_pi_generated_do_id
    FOREIGN KEY (generated_do_id)
    REFERENCES delivery_order(do_id)
    ON DELETE SET NULL;

-- delivery_order_item — Line items for a Delivery Order.
CREATE TABLE delivery_order_item (
    doi_id           SERIAL        PRIMARY KEY,
    do_id            UUID          NOT NULL REFERENCES delivery_order(do_id) ON DELETE CASCADE,
    item_id          INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,
    item_name        VARCHAR(255),
    item_description TEXT          NOT NULL,
    uom              VARCHAR(20),
    do_quantity      DECIMAL       NOT NULL DEFAULT 1
        CONSTRAINT chk_doi_quantity CHECK (do_quantity > 0),
    unit_price       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_doi_unit_price CHECK (unit_price >= 0),
    discount         DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_doi_discount CHECK (discount >= 0),
    -- (do_quantity × unit_price) − discount
    line_total       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_doi_line_total CHECK (line_total >= 0),
    log_id           BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_doi_do_id   ON delivery_order_item(do_id);
CREATE INDEX idx_doi_item_id ON delivery_order_item(item_id);
CREATE INDEX idx_doi_log_id  ON delivery_order_item(log_id);

-- ==============================================
-- STEP 18: CREATE SALES INVOICE TABLES
-- ==============================================

-- sales_invoice — Supplier generates this from a Delivery Order.
-- do_id is nullable — can be created directly without a prior DO.
-- No status condition required — invoice can be generated at any time after DO exists.
--
CREATE TABLE sales_invoice (
    si_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number: 'SI-' || LPAD(nextval('seq_si_no'), 6, '0')
    si_no         VARCHAR(20)   NOT NULL UNIQUE,

    reference_no  VARCHAR(100),
    terms         VARCHAR(100),

    -- Invoice due date (calculated from terms, editable)
    due_date      DATE,

    -- Which customer this invoice is addressed to (soft FK for traceability)
    customer_id              INTEGER REFERENCES customer(customer_id) ON DELETE SET NULL,

    -- ── Customer snapshot ──────────────────────────────────────────
    customer_company_name    VARCHAR(200),
    customer_register_no     VARCHAR(50),
    customer_address         TEXT,
    customer_phone           VARCHAR(50),
    customer_email           VARCHAR(255),
    -- ──────────────────────────────────────────────────────────────

    -- Back-link to the Delivery Order this invoice was generated from.
    -- NULL if invoice was created directly.
    do_id         UUID REFERENCES delivery_order(do_id) ON DELETE SET NULL,

    -- Sales Invoice lifecycle status.
    -- Valid values from system_enum WHERE enum_group = 'SI_STATUS'.
    status        VARCHAR(20)   NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_si_status
            CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'closed')),

    remarks       TEXT,

    total_amount  DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_si_total CHECK (total_amount >= 0),

    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at    TIMESTAMP WITH TIME ZONE,
    log_id        BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_si_si_no       ON sales_invoice(si_no);
CREATE INDEX idx_si_customer_id ON sales_invoice(customer_id);
CREATE INDEX idx_si_do_id       ON sales_invoice(do_id);
CREATE INDEX idx_si_status      ON sales_invoice(status);
CREATE INDEX idx_si_created_by  ON sales_invoice(created_by);
CREATE INDEX idx_si_log_id      ON sales_invoice(log_id);

-- Circular FK: delivery_order.generated_si_id → sales_invoice.si_id
ALTER TABLE delivery_order
    ADD CONSTRAINT fk_do_generated_si_id
    FOREIGN KEY (generated_si_id)
    REFERENCES sales_invoice(si_id)
    ON DELETE SET NULL;

-- sales_invoice_item — Line items for a Sales Invoice.
CREATE TABLE sales_invoice_item (
    sii_id           SERIAL        PRIMARY KEY,
    si_id            UUID          NOT NULL REFERENCES sales_invoice(si_id) ON DELETE CASCADE,
    item_id          INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,
    item_name        VARCHAR(255),
    item_description TEXT          NOT NULL,
    uom              VARCHAR(20),
    si_quantity      DECIMAL       NOT NULL DEFAULT 1
        CONSTRAINT chk_sii_quantity CHECK (si_quantity > 0),
    unit_price       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_sii_unit_price CHECK (unit_price >= 0),
    discount         DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_sii_discount CHECK (discount >= 0),
    -- (si_quantity × unit_price) − discount
    line_total       DECIMAL(15,2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_sii_line_total CHECK (line_total >= 0),
    log_id           BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_sii_si_id   ON sales_invoice_item(si_id);
CREATE INDEX idx_sii_item_id ON sales_invoice_item(item_id);
CREATE INDEX idx_sii_log_id  ON sales_invoice_item(log_id);

-- ==============================================
-- STEP 19: HELPER FUNCTIONS
-- ==============================================

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
-- STEP 20: ROW LEVEL SECURITY (RLS)
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
ALTER TABLE quotation             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_item        ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice           ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_item      ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_order        ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_order_item   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_invoice_item    ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Allow all" ON quotation             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON quotation_item        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON proforma_invoice           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON proforma_invoice_item      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON delivery_order        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON delivery_order_item   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON sales_invoice         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON sales_invoice_item    FOR ALL USING (true) WITH CHECK (true);

-- ==============================================
-- STEP 21: GRANT PERMISSIONS
-- ==============================================

-- Sequences — user display IDs
GRANT USAGE, SELECT ON SEQUENCE seq_user_a TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_m TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_s TO postgres, authenticated, anon, service_role;

-- Sequences — purchase cycle document numbers
GRANT USAGE, SELECT ON SEQUENCE seq_pr_no   TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_po_no   TO postgres, authenticated, anon, service_role;

-- Sequences — sales cycle document numbers
GRANT USAGE, SELECT ON SEQUENCE seq_quot_no TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_pi_no   TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_do_no   TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_si_no   TO postgres, authenticated, anon, service_role;

-- Role table (read-only)
GRANT SELECT ON public.role TO postgres, authenticated, anon, service_role;

-- Users
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Enum lookup
GRANT SELECT ON public.system_enum TO authenticated, anon, service_role;
GRANT INSERT, UPDATE, DELETE ON public.system_enum TO authenticated;

-- Business tables
GRANT ALL ON public.supplier       TO authenticated;
GRANT ALL ON public.customer       TO authenticated;
GRANT ALL ON public.tax            TO authenticated;
GRANT ALL ON public.liabilities    TO authenticated;
GRANT ALL ON public.bank_acc       TO authenticated;
GRANT ALL ON public.contact_info   TO authenticated;
GRANT ALL ON public.classification TO authenticated;
GRANT ALL ON public.inventory      TO authenticated;
GRANT ALL ON public.stock_movement TO authenticated;

-- Company settings
GRANT SELECT, UPDATE ON public.company_settings TO authenticated;

-- Purchase cycle tables
GRANT ALL ON public.purchase_request      TO authenticated;
GRANT ALL ON public.purchase_request_item TO authenticated;
GRANT ALL ON public.purchase_order        TO authenticated;
GRANT ALL ON public.purchase_order_item   TO authenticated;

-- Sales cycle tables
GRANT ALL ON public.quotation          TO authenticated;
GRANT ALL ON public.quotation_item     TO authenticated;
GRANT ALL ON public.proforma_invoice        TO authenticated;
GRANT ALL ON public.proforma_invoice_item   TO authenticated;
GRANT ALL ON public.delivery_order     TO authenticated;
GRANT ALL ON public.delivery_order_item TO authenticated;
GRANT ALL ON public.sales_invoice      TO authenticated;
GRANT ALL ON public.sales_invoice_item TO authenticated;

-- Log / audit
GRANT SELECT ON public.log            TO authenticated, service_role;
GRANT INSERT ON public.log            TO service_role, authenticated;
GRANT SELECT ON public.tracked_tables TO authenticated, service_role;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.get_record_created_at   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_record_updated_at   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_user             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_sequence_value TO authenticated, anon;

-- SERIAL column sequences — existing tables
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

-- SERIAL column sequences — new sales cycle tables
GRANT USAGE ON SEQUENCE quotation_item_qi_id_seq         TO authenticated;
GRANT USAGE ON SEQUENCE proforma_invoice_item_pii_id_seq      TO authenticated;
GRANT USAGE ON SEQUENCE delivery_order_item_doi_id_seq   TO authenticated;
GRANT USAGE ON SEQUENCE sales_invoice_item_sii_id_seq    TO authenticated;

-- ==============================================
-- STEP 22: VERIFY SETUP (optional queries)
-- ==============================================
-- Check all public tables
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' ORDER BY table_name;

-- Confirm all tracked tables registered
-- SELECT table_id, table_name, table_code FROM tracked_tables ORDER BY table_id;

-- Confirm all system_enum groups and options
-- SELECT enum_group, enum_code, enum_label, sort_order
-- FROM system_enum ORDER BY enum_group, sort_order;

-- Confirm all document sequences exist
-- SELECT sequencename FROM pg_sequences
-- WHERE schemaname = 'public' ORDER BY sequencename;

-- Check full business flow for a quotation
-- SELECT
--   q.quot_no, q.status AS quot_status,
--   CASE WHEN q.generated_pi_id IS NULL THEN 'Available' ELSE 'Generated' END AS generate_status,
--   so.pi_no, so.status AS so_status,
--   CASE WHEN so.generated_do_id IS NULL THEN 'Available'
--        WHEN so.status != 'paid'        THEN 'Not Paid'
--        ELSE 'Generated' END AS do_generate_status,
--   do2.do_no, do2.status AS do_status,
--   CASE WHEN do2.generated_si_id IS NULL THEN 'Available' ELSE 'Generated' END AS si_generate_status,
--   si.si_no, si.status AS si_status
-- FROM quotation q
-- LEFT JOIN proforma_invoice    so   ON so.pi_id   = q.generated_pi_id
-- LEFT JOIN delivery_order do2  ON do2.do_id  = so.generated_do_id
-- LEFT JOIN sales_invoice  si   ON si.si_id   = do2.generated_si_id
-- ORDER BY q.quot_no;
