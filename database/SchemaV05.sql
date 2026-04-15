-- ============================================================================
-- SCHEMA V05 – PURCHASE REQUEST & PURCHASE ORDER
-- ============================================================================
-- This schema extends V04 with:
--   1. Sequences for PR and PO human-readable document numbers
--   2. purchase_request          – PR header record
--   3. purchase_request_item     – PR line items
--   4. purchase_order            – PO header record (optionally linked to a PR)
--   5. purchase_order_item       – PO line items (with unit price, discount, total)
--   6. tracked_tables updated    – PR and PO added for audit trail
--   7. RLS policies, grants, and indexes consistent with V04 pattern
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

DROP TABLE IF EXISTS purchase_order_item CASCADE;
DROP TABLE IF EXISTS purchase_order CASCADE;
DROP TABLE IF EXISTS purchase_request_item CASCADE;
DROP TABLE IF EXISTS purchase_request CASCADE;
DROP TABLE IF EXISTS quantity CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS contact_info CASCADE;
DROP TABLE IF EXISTS bank_acc CASCADE;
DROP TABLE IF EXISTS liabilities CASCADE;
DROP TABLE IF EXISTS tax CASCADE;
DROP TABLE IF EXISTS customer CASCADE;
DROP TABLE IF EXISTS supplier CASCADE;
DROP TABLE IF EXISTS classification CASCADE;
DROP TABLE IF EXISTS log CASCADE;
DROP TABLE IF EXISTS tracked_tables CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role CASCADE;

DROP SEQUENCE IF EXISTS seq_user_a;
DROP SEQUENCE IF EXISTS seq_user_m;
DROP SEQUENCE IF EXISTS seq_user_s;
DROP SEQUENCE IF EXISTS seq_pr_no;
DROP SEQUENCE IF EXISTS seq_po_no;

-- ==============================================
-- STEP 2: CREATE ROLE TABLE
-- ==============================================
CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,
    role_type VARCHAR(50) NOT NULL UNIQUE,   -- 'admin', 'manager', 'staff'
    role_code CHAR(1) NOT NULL UNIQUE        -- 'A', 'M', 'S'
);

INSERT INTO role (role_type, role_code) VALUES
    ('admin', 'A'),
    ('manager', 'M'),
    ('staff', 'S');

-- ==============================================
-- STEP 3: CREATE SEQUENCES
-- ==============================================
-- User display ID sequences (per role)
CREATE SEQUENCE seq_user_a START 1;   -- Admin  (A)
CREATE SEQUENCE seq_user_m START 1;   -- Manager (M)
CREATE SEQUENCE seq_user_s START 1;   -- Staff  (S)

-- Document number sequences
-- Generates: PR-000001, PR-000002 ...
CREATE SEQUENCE seq_pr_no START 1;
-- Generates: PO-000001, PO-000002 ...
CREATE SEQUENCE seq_po_no START 1;

-- ==============================================
-- STEP 4: CREATE TRACKED_TABLES LOOKUP
-- ==============================================
CREATE TABLE tracked_tables (
    table_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    table_code VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO tracked_tables (table_name, table_code) VALUES
    ('users',                'USERS'),
    ('supplier',             'SUPPLIER'),
    ('customer',             'CUSTOMER'),
    ('tax',                  'TAX'),
    ('liabilities',          'LIABILITIES'),
    ('bank_acc',             'BANK_ACC'),
    ('contact_info',         'CONTACT_INFO'),
    ('classification',       'CLASSIFICATION'),
    ('inventory',            'INVENTORY'),
    ('quantity',             'QUANTITY'),
    ('purchase_request',     'PURCHASE_REQUEST'),
    ('purchase_request_item','PURCHASE_REQUEST_ITEM'),
    ('purchase_order',       'PURCHASE_ORDER'),
    ('purchase_order_item',  'PURCHASE_ORDER_ITEM');

-- ==============================================
-- STEP 5: CREATE CENTRAL LOG TABLE (Audit Trail)
-- ==============================================
CREATE TABLE log (
    log_id BIGSERIAL PRIMARY KEY,
    table_id INTEGER NOT NULL REFERENCES tracked_tables(table_id),
    record_id VARCHAR(100) NOT NULL,         -- ID of the record (as string for flexibility)
    action_type VARCHAR(10) NOT NULL,        -- INSERT, UPDATE, DELETE
    action_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    action_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_data JSONB,                      -- before/after values (optional)
    CONSTRAINT chk_log_action_type CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE'))
);

CREATE INDEX idx_log_table_record_time ON log(table_id, record_id, action_at DESC);
CREATE INDEX idx_log_action_at ON log(action_at);
CREATE INDEX idx_log_action_by ON log(action_by);

-- ==============================================
-- STEP 6: CREATE USERS TABLE
-- ==============================================
CREATE TABLE users (
    auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_id VARCHAR(20) NOT NULL UNIQUE,
    role_id INTEGER NOT NULL REFERENCES role(role_id),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_display_id ON users(display_id);
CREATE INDEX idx_users_log_id ON users(log_id);

-- ==============================================
-- STEP 7: CREATE CLASSIFICATION TABLE
-- ==============================================
CREATE TABLE classification (
    classification_id SERIAL PRIMARY KEY,
    classification_code VARCHAR(20) NOT NULL UNIQUE,
    classification_title VARCHAR(100) NOT NULL,
    classification_description TEXT,
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_classification_code ON classification(classification_code);
CREATE INDEX idx_classification_log_id ON classification(log_id);

-- ==============================================
-- STEP 8: CREATE BUSINESS TABLES
-- ==============================================

-- tax
CREATE TABLE tax (
    tax_id SERIAL PRIMARY KEY,
    BRN VARCHAR(50),
    TIN VARCHAR(50),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_tax_log_id ON tax(log_id);

-- liabilities
CREATE TABLE liabilities (
    liabilities_id SERIAL PRIMARY KEY,
    credit_terms VARCHAR(50),
    credit_limit DECIMAL,
    allow_exceed_credit_limit BOOLEAN,
    invoice_date DATE,
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_liabilities_log_id ON liabilities(log_id);

-- bank_acc
CREATE TABLE bank_acc (
    bank_id SERIAL PRIMARY KEY,
    bank_name VARCHAR(100),
    acc_no VARCHAR(50),
    acc_name VARCHAR(100),
    ref VARCHAR(100),
    status VARCHAR(20),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_bank_acc_log_id ON bank_acc(log_id);

-- contact_info
CREATE TABLE contact_info (
    contact_id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    post_code VARCHAR(20),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_contact_info_log_id ON contact_info(log_id);

-- supplier
CREATE TABLE supplier (
    supplier_id SERIAL PRIMARY KEY,
    company_name VARCHAR(200),
    control_ac VARCHAR(50),
    branch_name VARCHAR(100),
    industry_name VARCHAR(100),
    industry_code VARCHAR(50),
    register_no_new VARCHAR(50),
    register_no_old VARCHAR(50),
    status VARCHAR(20),
    tax_id INTEGER REFERENCES tax(tax_id),
    bank_id INTEGER REFERENCES bank_acc(bank_id),
    contact_id INTEGER REFERENCES contact_info(contact_id),
    liabilities_id INTEGER REFERENCES liabilities(liabilities_id),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_supplier_tax_id ON supplier(tax_id);
CREATE INDEX idx_supplier_bank_id ON supplier(bank_id);
CREATE INDEX idx_supplier_contact_id ON supplier(contact_id);
CREATE INDEX idx_supplier_liabilities_id ON supplier(liabilities_id);
CREATE INDEX idx_supplier_log_id ON supplier(log_id);

-- customer
CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    company_name VARCHAR(200),
    control_ac VARCHAR(50),
    branch_name VARCHAR(100),
    industry_name VARCHAR(100),
    industry_code VARCHAR(50),
    register_no_new VARCHAR(50),
    register_no_old VARCHAR(50),
    status VARCHAR(20),
    tax_id INTEGER REFERENCES tax(tax_id),
    bank_id INTEGER REFERENCES bank_acc(bank_id),
    contact_id INTEGER REFERENCES contact_info(contact_id),
    liabilities_id INTEGER REFERENCES liabilities(liabilities_id),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_customer_tax_id ON customer(tax_id);
CREATE INDEX idx_customer_bank_id ON customer(bank_id);
CREATE INDEX idx_customer_contact_id ON customer(contact_id);
CREATE INDEX idx_customer_liabilities_id ON customer(liabilities_id);
CREATE INDEX idx_customer_log_id ON customer(log_id);

-- inventory
CREATE TABLE inventory (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,
    description TEXT,
    group_id VARCHAR(50),
    uom VARCHAR(20),
    ref_cost DECIMAL,
    ref_price DECIMAL,
    quantity_id INTEGER,
    serial_number VARCHAR(100),
    remark_1 TEXT,
    remark_2 TEXT,
    balance_qty DECIMAL,
    classification_id INTEGER REFERENCES classification(classification_id),
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_inventory_item_name ON inventory(item_name);
CREATE INDEX idx_inventory_classification_id ON inventory(classification_id);
CREATE INDEX idx_inventory_quantity_id ON inventory(quantity_id);
CREATE INDEX idx_inventory_log_id ON inventory(log_id);

-- quantity
CREATE TABLE quantity (
    quantity_id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES inventory(item_id),
    quantity INTEGER,
    invoice_id INTEGER,
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_quantity_item_id ON quantity(item_id);
CREATE INDEX idx_quantity_log_id ON quantity(log_id);

ALTER TABLE inventory ADD CONSTRAINT fk_inventory_quantity
    FOREIGN KEY (quantity_id) REFERENCES quantity(quantity_id);

-- ==============================================
-- STEP 9: CREATE PURCHASE REQUEST TABLES
-- ==============================================

-- purchase_request — Header record for a Purchase Request document
-- Each PR is sent from the own company (buyer) to a supplier,
-- listing items to be requested before a formal order is confirmed.
CREATE TABLE purchase_request (
    pr_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number, e.g. "PR-000001"
    -- Built from seq_pr_no on insert: 'PR-' || LPAD(nextval, 6, '0')
    pr_no VARCHAR(20) NOT NULL UNIQUE,

    -- Reference number manually typed by user (supplier's ref, internal ref, etc.)
    reference_no VARCHAR(100),

    -- Payment / delivery terms provided by supplier, e.g. "30 days", "Net 45 days"
    terms VARCHAR(100),

    -- Which supplier this PR is addressed to (FK to supplier table)
    supplier_id INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,

    -- Status of the PR lifecycle
    -- 'draft'    – created but not yet sent
    -- 'sent'     – sent to supplier
    -- 'received' – supplier has acknowledged
    -- 'closed'   – converted to PO or cancelled
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_pr_status CHECK (status IN ('draft', 'sent', 'received', 'closed')),

    -- Remark / description message from sender to receiver (printed on the document)
    remarks TEXT,

    -- Audit: who printed / generated the PDF for this document
    -- Populated at print time. References users.auth_id.
    printed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at TIMESTAMP WITH TIME ZONE,

    -- Audit trail FK (points to the INSERT log entry for this record)
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_pr_pr_no ON purchase_request(pr_no);
CREATE INDEX idx_pr_supplier_id ON purchase_request(supplier_id);
CREATE INDEX idx_pr_status ON purchase_request(status);
CREATE INDEX idx_pr_printed_by ON purchase_request(printed_by);
CREATE INDEX idx_pr_log_id ON purchase_request(log_id);

-- -----------------------------------------------
-- purchase_request_item — Line items for a PR
-- -----------------------------------------------
-- Each row is one requested item within a Purchase Request.
-- item_no is a user-visible sequence within the document (1, 2, 3…),
-- not the database PK; it determines the printed order.
CREATE TABLE purchase_request_item (
    pri_id SERIAL PRIMARY KEY,

    -- Parent PR
    pr_id UUID NOT NULL REFERENCES purchase_request(pr_id) ON DELETE CASCADE,

    -- Visible line number on the printed document (1, 2, 3…)
    -- Assigned by the application in the order items are added.
    item_no INTEGER NOT NULL,

    -- Link to an existing inventory item (optional: user may request a non-catalogue item)
    item_id INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,

    -- Free-text description (pre-filled from inventory if item_id is provided,
    -- but editable so user can add notes or request a custom item)
    item_description TEXT NOT NULL,

    -- Unit of measure (pre-filled from inventory.uom, editable)
    uom VARCHAR(20),

    -- Quantity being requested
    quantity DECIMAL NOT NULL DEFAULT 1
        CONSTRAINT chk_pri_qty CHECK (quantity > 0),

    -- Audit trail FK
    log_id BIGINT REFERENCES log(log_id),

    -- Enforce unique item_no per PR (no duplicate line numbers within same document)
    CONSTRAINT uq_pri_pr_item_no UNIQUE (pr_id, item_no)
);

CREATE INDEX idx_pri_pr_id ON purchase_request_item(pr_id);
CREATE INDEX idx_pri_item_id ON purchase_request_item(item_id);
CREATE INDEX idx_pri_log_id ON purchase_request_item(log_id);

-- ==============================================
-- STEP 10: CREATE PURCHASE ORDER TABLES
-- ==============================================

-- purchase_order — Header record for a Purchase Order document
-- Sent by the buyer to a supplier to confirm the trade after reviewing
-- the supplier's quotation. Optionally linked back to the originating PR.
CREATE TABLE purchase_order (
    po_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- System-generated display number, e.g. "PO-000001"
    po_no VARCHAR(20) NOT NULL UNIQUE,

    -- Reference number manually typed by user
    reference_no VARCHAR(100),

    -- Payment terms agreed, e.g. "Net 30 days", "Net 45 days"
    terms VARCHAR(100),

    -- Delivery date requested by buyer
    delivery_date DATE,

    -- Which supplier this PO is addressed to
    supplier_id INTEGER REFERENCES supplier(supplier_id) ON DELETE SET NULL,

    -- Optional back-reference to the Purchase Request this PO was raised from.
    -- NULL means the PO was created directly without a prior PR.
    pr_id UUID REFERENCES purchase_request(pr_id) ON DELETE SET NULL,

    -- Status of the PO lifecycle
    -- 'draft'     – created but not yet sent
    -- 'sent'      – sent to supplier
    -- 'confirmed' – supplier has confirmed the order
    -- 'received'  – goods/services have been received
    -- 'closed'    – fully completed or cancelled
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CONSTRAINT chk_po_status CHECK (status IN ('draft', 'sent', 'confirmed', 'received', 'closed')),

    -- Remark / description message from sender to receiver (printed on the document)
    remarks TEXT,

    -- Computed total order amount (sum of all line totals after discount).
    -- Updated by the application whenever line items change.
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_po_total CHECK (total_amount >= 0),

    -- Audit: who printed / generated the PDF for this document
    printed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    printed_at TIMESTAMP WITH TIME ZONE,

    -- Audit trail FK
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_po_po_no ON purchase_order(po_no);
CREATE INDEX idx_po_supplier_id ON purchase_order(supplier_id);
CREATE INDEX idx_po_pr_id ON purchase_order(pr_id);
CREATE INDEX idx_po_status ON purchase_order(status);
CREATE INDEX idx_po_printed_by ON purchase_order(printed_by);
CREATE INDEX idx_po_log_id ON purchase_order(log_id);

-- -----------------------------------------------
-- purchase_order_item — Line items for a PO
-- -----------------------------------------------
-- Each row is one ordered item within a Purchase Order.
-- Extends PR items with pricing: unit_price, discount, and computed line_total.
CREATE TABLE purchase_order_item (
    poi_id SERIAL PRIMARY KEY,

    -- Parent PO
    po_id UUID NOT NULL REFERENCES purchase_order(po_id) ON DELETE CASCADE,

    -- Visible line number on the printed document (1, 2, 3…)
    item_no INTEGER NOT NULL,

    -- Link to an existing inventory item (optional)
    item_id INTEGER REFERENCES inventory(item_id) ON DELETE SET NULL,

    -- Free-text description (pre-filled from inventory if item_id provided, editable)
    item_description TEXT NOT NULL,

    -- Unit of measure
    uom VARCHAR(20),

    -- Quantity ordered
    quantity DECIMAL NOT NULL DEFAULT 1
        CONSTRAINT chk_poi_qty CHECK (quantity > 0),

    -- Price per unit (as agreed with supplier from quotation)
    unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_unit_price CHECK (unit_price >= 0),

    -- Discount amount per line (optional; 0.00 means no discount)
    -- Stored as an absolute value in currency, not a percentage.
    -- If you need percentage discounts in future, add a discount_pct column.
    discount DECIMAL(15, 2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_discount CHECK (discount >= 0),

    -- Computed line total: (quantity * unit_price) - discount
    -- Maintained by the application on every insert/update.
    line_total DECIMAL(15, 2) NOT NULL DEFAULT 0.00
        CONSTRAINT chk_poi_line_total CHECK (line_total >= 0),

    -- Audit trail FK
    log_id BIGINT REFERENCES log(log_id),

    -- Enforce unique item_no per PO
    CONSTRAINT uq_poi_po_item_no UNIQUE (po_id, item_no)
);

CREATE INDEX idx_poi_po_id ON purchase_order_item(po_id);
CREATE INDEX idx_poi_item_id ON purchase_order_item(item_id);
CREATE INDEX idx_poi_log_id ON purchase_order_item(log_id);

-- ==============================================
-- STEP 11: HELPER FUNCTIONS
-- ==============================================

-- get_record_created_at
CREATE OR REPLACE FUNCTION public.get_record_created_at(
    p_table_id INTEGER,
    p_record_id VARCHAR
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT action_at
    FROM log
    WHERE table_id = p_table_id
      AND record_id = p_record_id
      AND action_type = 'INSERT'
    ORDER BY action_at DESC
    LIMIT 1;
$$;

-- get_record_updated_at
CREATE OR REPLACE FUNCTION public.get_record_updated_at(
    p_table_id INTEGER,
    p_record_id VARCHAR
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT action_at
    FROM log
    WHERE table_id = p_table_id
      AND record_id = p_record_id
      AND action_type IN ('INSERT', 'UPDATE')
    ORDER BY action_at DESC
    LIMIT 1;
$$;

-- get_next_sequence_value (frontend fallback)
CREATE OR REPLACE FUNCTION public.get_next_sequence_value(seq_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_val bigint;
BEGIN
  EXECUTE 'SELECT nextval(' || quote_literal(seq_name) || ')' INTO next_val;
  RETURN next_val;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_sequence_value TO authenticated, anon;

-- insert_user
CREATE OR REPLACE FUNCTION public.insert_user(
    p_auth_id UUID,
    p_email VARCHAR,
    p_first_name VARCHAR,
    p_last_name VARCHAR,
    p_role_code CHAR
)
RETURNS TABLE (success BOOLEAN, message VARCHAR, user_id UUID, display_id VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id INTEGER;
    v_nextval BIGINT;
    v_display_id VARCHAR(20);
    v_seq_name VARCHAR(20);
BEGIN
    SELECT role_id INTO v_role_id
    FROM role
    WHERE role_code = p_role_code;

    IF NOT FOUND THEN
        SELECT role_id INTO v_role_id FROM role WHERE role_code = 'S';
    END IF;

    IF p_role_code = 'A' THEN
        v_seq_name := 'seq_user_a';
    ELSIF p_role_code = 'M' THEN
        v_seq_name := 'seq_user_m';
    ELSE
        v_seq_name := 'seq_user_s';
    END IF;

    EXECUTE 'SELECT nextval(' || quote_literal(v_seq_name) || ')' INTO v_nextval;
    v_display_id := p_role_code || LPAD(v_nextval::TEXT, 4, '0');

    INSERT INTO users (auth_id, email, first_name, last_name, display_id, role_id, log_id)
    VALUES (p_auth_id, p_email, p_first_name, p_last_name, v_display_id, v_role_id, NULL)
    ON CONFLICT (auth_id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name;

    RETURN QUERY SELECT
        true::boolean,
        'User created successfully'::varchar,
        p_auth_id,
        v_display_id;

EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
        false::boolean,
        ('Error: ' || SQLERRM)::varchar,
        NULL::uuid,
        NULL::varchar;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_user TO authenticated, service_role;

-- ==============================================
-- STEP 12: ROW LEVEL SECURITY (RLS)
-- ==============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_acc ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE quantity ENABLE ROW LEVEL SECURITY;
ALTER TABLE log ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_request_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_item ENABLE ROW LEVEL SECURITY;

-- Development: allow all operations (replace with role-based policies before production)
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON supplier FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON customer FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON tax FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON liabilities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON bank_acc FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON contact_info FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON classification FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON quantity FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_request FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_request_item FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_order FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_order_item FOR ALL USING (true) WITH CHECK (true);

-- ==============================================
-- STEP 13: GRANT PERMISSIONS
-- ==============================================

-- Sequences — user roles
GRANT USAGE, SELECT ON SEQUENCE seq_user_a TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_m TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_s TO postgres, authenticated, anon, service_role;

-- Sequences — document numbers
GRANT USAGE, SELECT ON SEQUENCE seq_pr_no TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_po_no TO postgres, authenticated, anon, service_role;

-- Role table (read-only for app users)
GRANT SELECT ON public.role TO postgres, authenticated, anon, service_role;

-- Users table
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- Business tables
GRANT ALL ON public.supplier TO authenticated;
GRANT ALL ON public.customer TO authenticated;
GRANT ALL ON public.tax TO authenticated;
GRANT ALL ON public.liabilities TO authenticated;
GRANT ALL ON public.bank_acc TO authenticated;
GRANT ALL ON public.contact_info TO authenticated;
GRANT ALL ON public.classification TO authenticated;
GRANT ALL ON public.inventory TO authenticated;
GRANT ALL ON public.quantity TO authenticated;

-- Purchase tables
GRANT ALL ON public.purchase_request TO authenticated;
GRANT ALL ON public.purchase_request_item TO authenticated;
GRANT ALL ON public.purchase_order TO authenticated;
GRANT ALL ON public.purchase_order_item TO authenticated;

-- Log table
GRANT SELECT ON public.log TO authenticated, service_role;
GRANT INSERT ON public.log TO service_role, authenticated;
GRANT SELECT ON public.tracked_tables TO authenticated, service_role;

-- Helper functions
GRANT EXECUTE ON FUNCTION public.get_record_created_at TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_record_updated_at TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_user TO authenticated, service_role;

-- SERIAL column sequences (existing tables)
GRANT USAGE ON SEQUENCE supplier_supplier_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE customer_customer_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE tax_tax_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE liabilities_liabilities_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE bank_acc_bank_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE contact_info_contact_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE classification_classification_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE inventory_item_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE quantity_quantity_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE log_log_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE tracked_tables_table_id_seq TO authenticated;

-- SERIAL column sequences (new purchase tables)
GRANT USAGE ON SEQUENCE purchase_request_item_pri_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE purchase_order_item_poi_id_seq TO authenticated;

-- ==============================================
-- STEP 14: VERIFY SETUP (optional queries)
-- ==============================================
-- Check all tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Confirm new purchase tables are tracked
-- SELECT table_id, table_name, table_code FROM tracked_tables ORDER BY table_id;

-- Confirm PR/PO sequences exist
-- SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' ORDER BY sequencename;

-- Inspect purchase_request columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'purchase_request' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Inspect purchase_order_item columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'purchase_order_item' AND table_schema = 'public'
-- ORDER BY ordinal_position;
