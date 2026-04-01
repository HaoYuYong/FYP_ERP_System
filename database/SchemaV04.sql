-- ============================================================================
-- SCHEMA V04 – LOG-BASED AUDIT TRACKING WITH INVENTORY ENHANCEMENTS
-- ============================================================================
-- This schema extends V03 with:
--   1. Added item_name field to inventory table for item identification
--   2. Renamed 'company' to 'company_name' in supplier and customer tables
--   3. All other features remain the same (log-based audit, no timestamps)
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

-- ==============================================
-- STEP 2: CREATE ROLE TABLE
-- ==============================================
CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,
    role_type VARCHAR(50) NOT NULL UNIQUE,   -- 'admin', 'manager', 'staff'
    role_code CHAR(1) NOT NULL UNIQUE         -- 'A', 'M', 'S'
);

INSERT INTO role (role_type, role_code) VALUES
    ('admin', 'A'),
    ('manager', 'M'),
    ('staff', 'S');

-- ==============================================
-- STEP 3: CREATE SEQUENCES FOR DISPLAY_ID PER ROLE
-- ==============================================
CREATE SEQUENCE seq_user_a START 1;   -- Admin (A)
CREATE SEQUENCE seq_user_m START 1;   -- Manager (M)
CREATE SEQUENCE seq_user_s START 1;   -- Staff (S)

-- ==============================================
-- STEP 4: CREATE TRACKED_TABLES LOOKUP
-- ==============================================
CREATE TABLE tracked_tables (
    table_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    table_code VARCHAR(50) NOT NULL UNIQUE
);

INSERT INTO tracked_tables (table_name, table_code) VALUES
    ('users', 'USERS'),
    ('supplier', 'SUPPLIER'),
    ('customer', 'CUSTOMER'),
    ('tax', 'TAX'),
    ('liabilities', 'LIABILITIES'),
    ('bank_acc', 'BANK_ACC'),
    ('contact_info', 'CONTACT_INFO'),
    ('classification', 'CLASSIFICATION'),
    ('inventory', 'INVENTORY'),
    ('quantity', 'QUANTITY');

-- ==============================================
-- STEP 5: CREATE CENTRAL LOG TABLE (Audit Trail)
-- ==============================================
-- Single source of truth for all record lifecycle events
CREATE TABLE log (
    log_id BIGSERIAL PRIMARY KEY,
    table_id INTEGER NOT NULL REFERENCES tracked_tables(table_id),
    record_id VARCHAR(100) NOT NULL,          -- ID of the record (as string for flexibility)
    action_type VARCHAR(10) NOT NULL,         -- INSERT, UPDATE, DELETE
    action_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    action_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- who performed the action
    changed_data JSONB,                        -- before/after values (optional)
    CONSTRAINT chk_log_action_type CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE'))
);

-- Indexes for performance
CREATE INDEX idx_log_table_record_time ON log(table_id, record_id, action_at DESC);
CREATE INDEX idx_log_action_at ON log(action_at);
CREATE INDEX idx_log_action_by ON log(action_by);

-- ==============================================
-- STEP 6: CREATE USERS TABLE (log_id only, no timestamps)
-- ==============================================
CREATE TABLE users (
    auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_id VARCHAR(20) NOT NULL UNIQUE,
    role_id INTEGER NOT NULL REFERENCES role(role_id),
    log_id BIGINT REFERENCES log(log_id)     -- Points to creation log entry (INSERT)
);

-- Indexes on users
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
    log_id BIGINT REFERENCES log(log_id)     -- Points to creation log entry
);

CREATE INDEX idx_classification_code ON classification(classification_code);
CREATE INDEX idx_classification_log_id ON classification(log_id);

-- ==============================================
-- STEP 8: CREATE BUSINESS TABLES (log_id only, no timestamps)
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

-- supplier (CHANGED: 'company' → 'company_name')
CREATE TABLE supplier (
    supplier_id SERIAL PRIMARY KEY,
    company_name VARCHAR(200),                 -- CHANGED: was 'company'
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

-- customer (CHANGED: 'company' → 'company_name')
CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    company_name VARCHAR(200),                 -- CHANGED: was 'company'
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

-- inventory (CHANGED: Added 'item_name' field)
CREATE TABLE inventory (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(255) NOT NULL,           -- ADDED: Item name/label
    description TEXT,
    group_id VARCHAR(50),
    uom VARCHAR(20),
    ref_cost DECIMAL,
    ref_price DECIMAL,
    quantity_id INTEGER,                       -- will reference quantity after it's created
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

-- quantity (transactional)
CREATE TABLE quantity (
    quantity_id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES inventory(item_id),
    quantity INTEGER,
    invoice_id INTEGER,                    -- could be a sales/purchase invoice ID
    log_id BIGINT REFERENCES log(log_id)
);

CREATE INDEX idx_quantity_item_id ON quantity(item_id);
CREATE INDEX idx_quantity_log_id ON quantity(log_id);

-- Add the quantity_id FK after both tables exist
ALTER TABLE inventory ADD CONSTRAINT fk_inventory_quantity
    FOREIGN KEY (quantity_id) REFERENCES quantity(quantity_id);

-- ==============================================
-- STEP 9: CREATE HELPER FUNCTION TO GET CREATION TIMESTAMP
-- ==============================================
-- Query the log table to get when a record was created
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

-- ==============================================
-- STEP 10: CREATE HELPER FUNCTION TO GET LAST UPDATE TIMESTAMP
-- ==============================================
-- Query the log table to get last modification time
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

-- ==============================================
-- STEP 11: CREATE FUNCTION TO GET SEQUENCE VALUES (for frontend fallback)
-- ==============================================
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

-- ==============================================
-- STEP 12: CREATE FUNCTION TO INSERT NEW USER
-- ==============================================
-- This function is called from the application (not a trigger)
-- It handles the complete user creation in the users table
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
    -- Look up role_id by role_code
    SELECT role_id INTO v_role_id
    FROM role
    WHERE role_code = p_role_code;

    IF NOT FOUND THEN
        -- Default to staff (S) if role not found
        SELECT role_id INTO v_role_id FROM role WHERE role_code = 'S';
    END IF;

    -- Determine which sequence to use
    IF p_role_code = 'A' THEN
        v_seq_name := 'seq_user_a';
    ELSIF p_role_code = 'M' THEN
        v_seq_name := 'seq_user_m';
    ELSE
        v_seq_name := 'seq_user_s';
    END IF;

    -- Get next value from sequence
    EXECUTE 'SELECT nextval(' || quote_literal(v_seq_name) || ')' INTO v_nextval;

    -- Generate display_id
    v_display_id := p_role_code || LPAD(v_nextval::TEXT, 4, '0');

    -- Insert into users table (log_id will be populated by app or trigger later)
    INSERT INTO users (auth_id, email, first_name, last_name, display_id, role_id, log_id)
    VALUES (p_auth_id, p_email, p_first_name, p_last_name, v_display_id, v_role_id, NULL)
    ON CONFLICT (auth_id) DO UPDATE SET
        email = EXCLUDED.email,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name;

    -- Return success
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
-- STEP 13: ROW LEVEL SECURITY (RLS) – simplified for development
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

-- For development, allow all operations (replace with proper policies later)
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

-- ==============================================
-- STEP 14: GRANT PERMISSIONS
-- ==============================================
-- Grant sequence usage
GRANT USAGE, SELECT ON SEQUENCE seq_user_a TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_m TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE seq_user_s TO postgres, authenticated, anon, service_role;

-- Grant on tables
GRANT SELECT ON public.role TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;

-- For simplicity, grant all on business tables to authenticated (adjust as needed)
GRANT ALL ON public.supplier TO authenticated;
GRANT ALL ON public.customer TO authenticated;
GRANT ALL ON public.tax TO authenticated;
GRANT ALL ON public.liabilities TO authenticated;
GRANT ALL ON public.bank_acc TO authenticated;
GRANT ALL ON public.contact_info TO authenticated;
GRANT ALL ON public.classification TO authenticated;
GRANT ALL ON public.inventory TO authenticated;
GRANT ALL ON public.quantity TO authenticated;

-- Grant on log table
GRANT SELECT ON public.log TO authenticated, service_role;
GRANT INSERT ON public.log TO service_role, authenticated;
GRANT SELECT ON public.tracked_tables TO authenticated, service_role;

-- Grant helper functions
GRANT EXECUTE ON FUNCTION public.get_record_created_at TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_record_updated_at TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_user TO authenticated, service_role;

-- Grant on sequences of SERIAL columns
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

-- ==============================================
-- STEP 15: VERIFY SETUP (optional)
-- ==============================================
-- Check tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Check that tables have log_id field
-- SELECT table_name, column_name 
-- FROM information_schema.columns 
-- WHERE column_name = 'log_id' AND table_schema = 'public'
-- ORDER BY table_name;

-- Check inventory table has item_name field
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'inventory' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Check supplier and customer tables now use company_name
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('supplier', 'customer') AND table_schema = 'public'
-- ORDER BY table_name, ordinal_position;
