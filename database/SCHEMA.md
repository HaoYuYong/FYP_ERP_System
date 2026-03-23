# Schema V02 - Easy to Understand Guide

## 🚀 Quick Start
Copy and paste all SQL from **SchemaV02.txt** into your Supabase SQL Editor and run it.

---

## 📖 What is This Schema?

Think of a database schema like the **blueprint of a filing system**:
- **Tables** = Folders that hold specific types of information
- **Columns** = The specific details inside each folder (like Name, Email, etc.)
- **Rows** = Individual records (one person's data, one supplier's info, etc.)

SchemaV02 is designed for an **ERP (Enterprise Resource Planning) system** that manages:
- 👥 **Users & Roles** - Who can access the system
- 📊 **Suppliers & Customers** - Business partners and their information
- 💰 **Finances** - Taxes, bank accounts, credit terms
- 📦 **Inventory** - Products and stock levels
- 📝 **Audit Logs** - A complete history of who changed what and when

---

## 🔄 Key Changes from V01 to V02

### ❌ The Problem We Fixed

**SchemaV01** tried to automatically create user records using a **database trigger**:
- When someone signs up → Trigger fires → User record created automatically

**But Supabase has a bug:** Sometimes these triggers don't fire properly, causing:
- ✗ User can log in (auth created)
- ✗ But their user record isn't created in our table
- ✗ System breaks because user data is missing

### ✅ The Solution in V02

**Move the responsibility from database to application:**
1. Someone signs up → Supabase Auth creates their account
2. **Backend receives notification** → Backend explicitly creates user record
3. Backend also **logs this action** in the audit log
4. Now we have full control and visibility

**Result:** Reliable, debuggable, and we can see exactly what happened!

---

## 📊 Database Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Supabase Auth                        │
│              (External Authentication)                  │
│          - Handles login/signup/passwords               │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Backend Application         │
        │  (Node.js/Express)           │
        │  ├─ User Registration        │
        │  ├─ Create Display ID        │
        │  ├─ Insert to Users Table    │
        │  └─ Create Audit Log         │
        └──────────────────────────────┘
                       │
     ┌─────────────────┼─────────────────┐
     ▼                 ▼                 ▼
┌──────────┐    ┌──────────┐    ┌──────────────┐
│  Users   │◄──►│  Roles   │    │  Log (Audit) │
│ Tables   │    │ Table    │    │ Trail        │
└──────────┘    └──────────┘    └──────────────┘
     │
     ├────► Supplier Table
     ├────► Customer Table
     ├────► Inventory Table
     └────► Business Tables
```

### What This Means:
1. **Supabase Auth** - Just handles passwords and login tokens (pure authentication)
2. **Backend Application** - Handles business logic (creating users, logging changes)
3. **Database Tables** - Store all the actual business data

---

## 🏗️ Architecture Overview - SchemaV02


### 1️⃣ Role Table - Understanding User Roles

**Purpose:** This table stores the **different types of users** your system supports.

Think of it like a **company org chart**:
- You have different employee types: Manager, Staff, Admin
- Each type has specific permissions and responsibilities

**The Table:**
```sql
CREATE TABLE role (
    role_id SERIAL PRIMARY KEY,              -- 1, 2, 3...
    role_type VARCHAR(50) NOT NULL UNIQUE,   -- 'admin', 'manager', 'staff'
    role_code CHAR(1) NOT NULL UNIQUE        -- 'A', 'M', 'S'
);
```

**What Each Column Does:**

| Column | Purpose | Example |
|--------|---------|---------|
| `role_id` | Unique number for each role | 1 = Admin, 2 = Manager, 3 = Staff |
| `role_type` | Full name of the role | "admin", "manager", "staff" |
| `role_code` | Single letter shortcut | "A", "M", "S" |

**Example Data:**
```
role_id | role_type | role_code
--------|-----------|----------
   1    | admin     | A
   2    | manager   | M
   3    | staff     | S
```

**Why Have This Table?**
- ✓ Store role information in ONE place (not hardcoded everywhere)
- ✓ Easy to add new roles (e.g., "supervisor")
- ✓ Role changes only need to be updated here
- ✓ Used as a reference for the Users table

---

### 2️⃣ Sequences - Automatic Number Generators

**Purpose:** Generate unique, sequential numbers for creating **friendly user ID displays**.

**Simple Analogy:** Like a **ticket dispenser at a bank**:
- Someone takes a ticket → Machine prints "A0001"
- Next person takes ticket → Machine prints "A0002"
- Each role gets its own machine (admin, manager, staff)

**The Sequences:**
```sql
CREATE SEQUENCE seq_user_a START 1;   -- Admin machine starts at 1
CREATE SEQUENCE seq_user_m START 1;   -- Manager machine starts at 1
CREATE SEQUENCE seq_user_s START 1;   -- Staff machine starts at 1
```

**How Display IDs Are Created:**

Step 1: User signs up as "Admin"
```
Get next value from seq_user_a → returns 1
```

Step 2: Combine with role code
```
Role code = 'A'
Number = 1
Padded = "0001" (add zeros at the front)
Display ID = "A0001"
```

Step 3: Result
```
The admin's display ID is: A0001
Next admin gets: A0002
Next admin gets: A0003
```

**Why Not Use One Sequence for Everyone?**
- ✗ Would mix numbers: A0001, M0001, S0001, A0002 (confusing)
- ✓ With separate sequences: Admins are A0001, A0002... Managers are M0001, M0002...
- ✓ Each number means exactly what role it is
- ✓ No gaps or conflicts

---

### 3️⃣ Users Table - Storing User Information

**Purpose:** Store information about every user in the system.

**The Table:**
```sql
CREATE TABLE users (
    auth_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_id VARCHAR(20) NOT NULL UNIQUE,
    role_id INTEGER NOT NULL REFERENCES role(role_id),
    log_id BIGINT REFERENCES log(log_id),    -- Links to audit log
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Understanding Each Column:**

| Column | Type | Purpose | Example |
|--------|------|---------|---------|
| `auth_id` | UUID | Unique ID from Supabase Auth | 550e8400-e29b-41d4-a716-446655440000 |
| `email` | Text | User's email address | john@company.com |
| `first_name` | Text | User's first name | John |
| `last_name` | Text | User's last name | Smith |
| `display_id` | Text | **Friendly human-readable ID** | A0001 |
| `role_id` | Number | Reference to their role | 1 (means Admin) |
| `log_id` | Number | Record of when they were created | 12345 |
| `created_at` | Date/Time | When account was created | 2024-01-15 10:30:00 |
| `updated_at` | Date/Time | Last time record was updated | 2024-01-15 10:30:00 |

**Real Example:**
```
auth_id:   550e8400-e29b-41d4-a716-446655440000
email:     john.smith@company.com
first_name: John
last_name:  Smith
display_id: A0001           ← ✨ Human-friendly ID we show in UI!
role_id:    1               ← References role table (Admin)
log_id:     5               ← Records that action
created_at: 2024-01-15 10:30:00
updated_at: 2024-01-15 10:30:00
```

**Key Concept: Two Types of IDs**
- **auth_id** - System ID used internally for security
  - Complex: 550e8400-e29b-41d4-a716-446655440000
  - Secure: Hard to guess
  - Used: For linking to authentication
  
- **display_id** - Human-readable ID shown to users
  - Simple: A0001
  - Easy to remember
  - Used: In reports, dashboards, communication

---

### 4️⃣ Centralized Audit Logging System (NEW!)

**Purpose:** **Record EVERYTHING that happens** in the system - who changed what, when, and what changed.

**Real-World Analogy:**
Like a **security camera for your database**:
- Camera records: Time, what happened, who did it, before/after
- You can replay history anytime
- Helps find problems and prove who did what

**Two Tables:**

#### A. Tracked Tables Lookup
```sql
CREATE TABLE tracked_tables (
    table_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    table_code VARCHAR(50) NOT NULL UNIQUE
);
```

**Purpose:** A catalog of "which tables should we monitor?"

**Example Data:**
```
table_id | table_name  | table_code
---------|-------------|----------
   1     | users       | USERS
   2     | supplier    | SUPPLIER
   3     | customer    | CUSTOMER
   4     | inventory   | INVENTORY
   5     | tax         | TAX
```

**Why This Table?**
- Imagine monitoring 20 tables
- Instead of hardcoding table names everywhere, store them here
- Easy to add/remove tables from monitoring
- Single source of truth

#### B. Central Log Table
```sql
CREATE TABLE log (
    log_id BIGSERIAL PRIMARY KEY,
    table_id INTEGER NOT NULL REFERENCES tracked_tables(table_id),
    record_id VARCHAR(100) NOT NULL,
    action_type VARCHAR(10) NOT NULL,        -- INSERT, UPDATE, DELETE
    action_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    action_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    changed_data JSONB,
    CONSTRAINT chk_log_action_type CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE'))
);
```

**What Each Column Means:**

| Column | Purpose | Example |
|--------|---------|---------|
| `log_id` | Unique log entry number | 1, 2, 3, 4... |
| `table_id` | Which table was changed? | 2 (supplier table) |
| `record_id` | Which record in that table? | 15 (supplier #15) |
| `action_type` | What happened? | INSERT, UPDATE, or DELETE |
| `action_at` | When did it happen? | 2024-01-15 14:23:45 |
| `action_by` | Who did it? | UUID of the user |
| `changed_data` | Before/after values | `{"name": {"old": "ABC", "new": "ABC Corp"}}` |

**Real Example:**
```
log_id:     10
table_id:   2            (supplier table)
record_id:  15           (supplier ID 15)
action_type: UPDATE
action_at:  2024-01-15 14:23:45
action_by:  550e8400-e29b-41d4-a716-446655440000  (John Smith)
changed_data: {
  "company": {
    "old": "ABC Trading",
    "new": "ABC Trading Corp"
  },
  "status": {
    "old": "inactive",
    "new": "active"
  }
}
```

**This Log Entry Means:**
"On Jan 15 at 2:23 PM, John Smith updated supplier #15, changing the company name from 'ABC Trading' to 'ABC Trading Corp' and changing status from inactive to active."

**Benefits of Audit Logging:**
- ✓ **Compliance:** Prove what happened if there's a dispute
- ✓ **Debugging:** Find when something broke and who changed it
- ✓ **Security:** Detect suspicious activity
- ✓ **Accountability:** Everyone knows their actions are recorded
- ✓ **Recovery:** Understand state before/after changes

---

### 5️⃣ Business Tables - The Core Data

These tables store your actual business information:

#### Supplier Table
```sql
CREATE TABLE supplier (
    supplier_id SERIAL PRIMARY KEY,
    company VARCHAR(200),           -- Supplier company name
    control_ac VARCHAR(50),         -- Accounting code
    branch_name VARCHAR(100),       -- Which branch
    industry_name VARCHAR(100),     -- Type of business
    status VARCHAR(20),             -- Active/Inactive
    tax_id INTEGER REFERENCES tax(tax_id),
    bank_id INTEGER REFERENCES bank_acc(bank_id),
    contact_id INTEGER REFERENCES contact_info(contact_id),
    liabilities_id INTEGER REFERENCES liabilities(liabilities_id),
    log_id BIGINT REFERENCES log(log_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Example Supplier Record:**
```
supplier_id:    5
company:        Global Parts Co.
control_ac:     SUP-001
branch_name:    Singapore
industry_name:  Electronics & Components
status:         Active
tax_id:         3          ← Reference to tax info
bank_id:        2          ← Reference to bank account
contact_id:     8          ← Reference to contact info
log_id:         42         ← Audit log reference
```

#### Customer Table
(Similar structure to Supplier - stores your customers)

#### Tax Table
```sql
CREATE TABLE tax (
    tax_id SERIAL PRIMARY KEY,
    BRN VARCHAR(50),        -- Business Registration Number
    TIN VARCHAR(50),        -- Tax ID Number
    log_id BIGINT REFERENCES log(log_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Bank Account Table
```sql
CREATE TABLE bank_acc (
    bank_id SERIAL PRIMARY KEY,
    bank_name VARCHAR(100),      -- e.g., "DBS Bank"
    acc_no VARCHAR(50),          -- Account number
    acc_name VARCHAR(100),       -- Account holder name
    ref VARCHAR(100),            -- Reference code
    status VARCHAR(20),          -- Active/Inactive
    log_id BIGINT REFERENCES log(log_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Contact Info Table
```sql
CREATE TABLE contact_info (
    contact_id SERIAL PRIMARY KEY,
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    country VARCHAR(100),
    city VARCHAR(100),
    state VARCHAR(100),
    post_code VARCHAR(20),
    log_id BIGINT REFERENCES log(log_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Inventory Table
```sql
CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    product_name VARCHAR(200),
    sku VARCHAR(50),              -- Stock-keeping unit
    quantity_on_hand INTEGER,     -- Current stock
    reorder_level INTEGER,        -- Alert when below this
    unit_cost DECIMAL,
    log_id BIGINT REFERENCES log(log_id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Concept: Foreign Keys & Relationships**

When you see this:
```sql
tax_id INTEGER REFERENCES tax(tax_id)
```

It means: "This supplier has a tax_id that must exist in the tax table"

**Visual:**
```
Supplier Table          Tax Table
─────────────           ─────────
supplier_id 5    ──────► tax_id 3
tax_id: 3               BRN: XYZ123
company: ABC            TIN: ABC456
```

This **ensures data consistency** - a supplier can't reference a tax record that doesn't exist.



---

## 👤 How User Registration Works - Step by Step

### The Complete User Registration Flow

**User Registration Journey:**

```
1️⃣  User opens registration page
        ↓
2️⃣  User enters: Email, Password, Name, Role
        ↓
3️⃣  Clicks "Sign Up"
        ↓
4️⃣  Frontend sends data to Backend
        ↓
5️⃣  Backend calls Supabase Auth: "Create this user"
        ↓
6️⃣  Supabase Auth creates user & returns auth_id
        ↓
7️⃣  ✨ Backend Does These Steps:
        ├─ Look up role code ('A', 'M', 'S')
        ├─ Generate next display_id (A0001, M0001, etc.)
        ├─ Insert into users table
        └─ Create audit log entry
        ↓
8️⃣  Registration complete! ✓
```

### Step-by-Step Breakdown

**Step 1: User Signs Up**
```
Frontend Form Input:
- Email: john@company.com
- Password: SecurePass123!
- First Name: John
- Last Name: Smith
- Role: admin
```

**Step 2: Backend Receives Request**

```typescript
app.post('/auth/register', async (req, res) => {
    const { email, password, firstName, lastName, role } = req.body;
    
    // Passes to Supabase Auth
});
```

**Step 3: Supabase Auth Creates Account**
```
Supabase Auth Response:
{
    id: "550e8400-e29b-41d4-a716-446655440000",  ← auth_id
    email: "john@company.com",
    created_at: "2024-01-15T10:30:00Z"
}
```

**Step 4-5: Backend Processes User**

```typescript
async function createUserRecord(authUser, firstName, lastName, role) {
    
    // STEP A: Look up role details
    const roleData = await db.query(
        `SELECT role_id, role_code FROM role WHERE role_type = $1`,
        [role]  // e.g., 'admin'
    );
    // Returns: { role_id: 1, role_code: 'A' }
    
    // STEP B: Get next number from sequence
    const sequenceResult = await db.query(
        `SELECT nextval($1) as next_num`,
        [`seq_user_${roleData.role_code.toLowerCase()}`]  // seq_user_a
    );
    const nextNum = sequenceResult.next_num;  // Returns: 1
    
    // STEP C: Create display_id
    const displayId = roleData.role_code + String(nextNum).padStart(4, '0');
    // Result: 'A' + '0001' = 'A0001'
    
    // STEP D: Insert into users table
    const newUser = await db.query(
        `INSERT INTO users (auth_id, email, first_name, last_name, display_id, role_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [authUser.id, authUser.email, firstName, lastName, displayId, roleData.role_id]
    );
    
    // STEP E: Create audit log entry
    await db.query(
        `INSERT INTO log (table_id, record_id, action_type, action_by, changed_data)
         VALUES (
             (SELECT table_id FROM tracked_tables WHERE table_name = 'users'),
             $1,
             'INSERT',
             $2,
             $3
         )`,
        [newUser.auth_id, authUser.id, JSON.stringify({ created_user: newUser })]
    );
    
    return newUser;
}
```

**Step 6: Final User Record Created**
```
Row in users table:
auth_id:     550e8400-e29b-41d4-a716-446655440000
email:       john@company.com
first_name:  John
last_name:   Smith
display_id:  A0001        ← ✨ Human-friendly ID
role_id:     1            ← Admin
log_id:      42           ← Audit trail
created_at:  2024-01-15 10:30:00
updated_at:  2024-01-15 10:30:00
```

**Step 7: Audit Log Entry Created**
```
Row in log table:
log_id:      42
table_id:    1            ← users table
record_id:   550e8400-e29b-41d4-a716-446655440000
action_type: INSERT
action_by:   550e8400-e29b-41d4-a716-446655440000  (admin who registered)
action_at:   2024-01-15 10:30:00
changed_data: {
  "created_user": {
    "auth_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@company.com",
    "display_id": "A0001",
    "role_id": 1
  }
}
```

### What Happens After Registration

1. User receives confirmation email (from Supabase Auth)
2. User logs in with email/password
3. Backend validates auth token
4. ✓ User can now access the system with role "Admin"
5. Their actions will be logged in the audit table

---

## 📝 How to Use Audit Logs - Practical Examples

### Query 1: Find All Changes to a Specific Supplier

**Scenario:** "Someone changed supplier #15's information. Who did it? What changed?"

```sql
SELECT 
    l.log_id,
    l.action_type,           -- INSERT, UPDATE, or DELETE
    l.action_at,             -- When it happened
    u.display_id,            -- Who did it (friendly ID)
    u.first_name,
    l.changed_data           -- What changed
FROM log l
JOIN users u ON l.action_by = u.auth_id
WHERE l.table_id = (SELECT table_id FROM tracked_tables WHERE table_name = 'supplier')
  AND l.record_id = '15'
ORDER BY l.action_at DESC;
```

**Result:**
```
log_id | action_type | action_at           | display_id | first_name | changed_data
-------|-------------|---------------------|------------|------------|─────────────
 42    | UPDATE      | 2024-01-15 14:23:45 | M0001      | Mary       | {"status": {"old": "inactive", "new": "active"}}
 35    | INSERT      | 2024-01-15 09:00:00 | A0001      | John       | {"company": "ABC Trading", ...}
```

**Translation:** John created supplier #15, then Mary later activated it.

### Query 2: Find All Actions by a Specific User

**Scenario:** "Show everything John did today"

```sql
SELECT 
    l.log_id,
    t.table_name,            -- Which table
    l.record_id,             -- Which record
    l.action_type,           -- What happened
    l.action_at              -- When
FROM log l
JOIN tracked_tables t ON l.table_id = t.table_id
JOIN users u ON l.action_by = u.auth_id
WHERE u.display_id = 'A0001'
  AND DATE(l.action_at) = '2024-01-15'
ORDER BY l.action_at DESC;
```

**Result:**
```
log_id | table_name | record_id | action_type | action_at
-------|------------|-----------|-------------|──────────────────────
 45    | inventory  | 23        | UPDATE      | 2024-01-15 14:50:00
 42    | supplier   | 15        | UPDATE      | 2024-01-15 14:23:45
 38    | users      | 5         | INSERT      | 2024-01-15 10:30:00
```

**Translation:** John today: registered 1 user, created 1 supplier, updated 1 inventory item.

### Query 3: See What Changed in an Update

**Scenario:** "Show me the before and after for that supplier update"

```sql
SELECT 
    l.changed_data->'before' as before_values,
    l.changed_data->'after' as after_values
FROM log l
WHERE l.log_id = 42;
```

**Result:**
```json
{
  "before": {
    "company": "ABC Trading",
    "status": "inactive"
  },
  "after": {
    "company": "ABC Trading", 
    "status": "active"
  }
}
```

**Translation:** The company name stayed the same, but we activated this supplier.

### Query 4: Find Suspicious Activity

**Scenario:** "Who deleted records? Show all DELETE actions in the last week"

```sql
SELECT 
    l.log_id,
    t.table_name,
    l.record_id,
    u.display_id,
    u.first_name,
    l.action_at
FROM log l
JOIN tracked_tables t ON l.table_id = t.table_id
JOIN users u ON l.action_by = u.auth_id
WHERE l.action_type = 'DELETE'
  AND l.action_at > NOW() - INTERVAL '7 days'
ORDER BY l.action_at DESC;
```

**Result:** Quickly see who deleted what and when - easy to investigate suspicious activity!

---

### 3. Application-Level User Creation Flow

Instead of a database trigger, the backend application now:

1. **User signs up** via Supabase Auth
2. **Backend intercepts** the sign-up event (e.g., via webhook or API call)
3. **Backend generates display_id** by calling `nextval()` on the appropriate sequence
4. **Backend inserts** into the `users` table with the generated display_id
5. **Backend logs** the creation in the `log` table

**Code Example (TypeScript):**
```typescript
async function createUserRecord(authUser: AuthUser, role: string) {
    // 1. Get role details
    const roleData = await db.query(`SELECT role_id, role_code FROM role WHERE role_type = $1`, [role]);
    
    // 2. Get next sequence value
    const nextVal = await db.query(`SELECT nextval($1)`, [`seq_user_${roleData.role_code.toLowerCase()}`]);
    
    // 3. Generate display_id
    const displayId = roleData.role_code + String(nextVal).padStart(4, '0');
    
    // 4. Insert user record
    const userRecord = await db.query(
        `INSERT INTO users (auth_id, email, first_name, last_name, display_id, role_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [authUser.id, authUser.email, authUser.firstName, authUser.lastName, displayId, roleData.role_id]
    );
    
    // 5. Log the action
    await db.query(
        `INSERT INTO log (table_id, record_id, action_type, action_by, changed_data)
         SELECT (SELECT table_id FROM tracked_tables WHERE table_name = 'users'), $1, 'INSERT', $2, $3`,
        [userRecord.auth_id, authUser.id, JSON.stringify({ created_user: userRecord })]
    );
    
    return userRecord;
}
```

### 4. Key Advantages of V02

| Aspect | V01 (Trigger-based) | V02 (Application code) |
|--------|---------------------|----------------------|
| **Reliability** | Supabase triggers on auth.users are unreliable | ✓ Fully under application control |
| **Debugging** | Errors hidden in trigger logs | ✓ Visible in application logs |
| **Error Handling** | Limited; trigger failures don't block auth | ✓ Robust error handling with rollback support |
| **Logging** | No centralized audit trail | ✓ Full audit trail via `log` table |
| **Flexibility** | Fixed trigger logic | ✓ Can customize on the fly |
| **Performance** | One-step (trigger) | Two-step (application + DB) – negligible difference |

### 5. Sequences for Display ID Generation

Sequences remain unchanged and work the same way:

```sql
CREATE SEQUENCE seq_user_a START 1;   -- Admin (A)
CREATE SEQUENCE seq_user_m START 1;   -- Manager (M)
CREATE SEQUENCE seq_user_s START 1;   -- Staff (S)
```

**Example display_id generation:**
- Admin: A + 0001 = **A0001**, A0002, A0003...
- Manager: M + 0001 = **M0001**, M0002, M0003...
- Staff: S + 0001 = **S0001**, S0002, S0003...

**Why per-role sequences?**
- Gap-free numbering per role
- No conflicts between roles
- Scalable at high user volumes

### 6. Business Tables (Extended)

SchemaV02 includes several interconnected business tables for managing suppliers, customers, inventory, and related data:

**Supplier Table:**
- Stores supplier company information, tax details, banking info, and liabilities
- References: `tax_id`, `bank_id`, `contact_id`, `liabilities_id`
- Includes `log_id` for audit trail

**Customer Table:**
- Mirror structure to supplier table for managing customer relationships
- Contains company info, control account, bank details, contact info, and credit terms

**Tax Table:**
- Business registration info (BRN, TIN)
- Linked to both suppliers and customers

**Liabilities Table:**
- Credit terms and limits
- Tracks invoice dates and credit overflow policies

**Bank Account Table:**
- Bank name, account number, account holder name
- Reference field and status tracking

**Contact Info Table:**
- Email, phone, address, country, city, state, postal code
- Shared reference for suppliers, customers, and users

**Classification Table:**
- Taxonomy of business classifications
- Referenced by products, suppliers, and customers

**Inventory & Quantity Tables:**
- Inventory: Product information, stock levels, reorder points
- Quantity: Historical quantity tracking or transaction-level tracking

All these tables have:
- `log_id` field pointing to the audit log
- `created_at` and `updated_at` timestamps
- Proper foreign key constraints

### 7. Implementing Audit Logging in Your Application

When implementing CRUD operations in your backend, follow this pattern:

**For INSERT operations:**
```typescript
async function createSupplier(supplierData: any, userId: UUID) {
    // 1. Insert supplier record
    const supplier = await db.query(`INSERT INTO supplier (...) VALUES (...) RETURNING *`);
    
    // 2. Create log entry
    await createLogEntry({
        table_id: 'SUPPLIER',
        record_id: supplier.supplier_id,
        action_type: 'INSERT',
        action_by: userId,
        changed_data: { new_record: supplier }
    });
    
    return supplier;
}
```

**For UPDATE operations:**
```typescript
async function updateSupplier(supplierId: number, updates: any, userId: UUID) {
    // 1. Get old record
    const oldRecord = await db.query(`SELECT * FROM supplier WHERE supplier_id = $1`, [supplierId]);
    
    // 2. Update record
    const newRecord = await db.query(`UPDATE supplier SET ... WHERE supplier_id = $1 RETURNING *`, [supplierId]);
    
    // 3. Create log entry with before/after
    await createLogEntry({
        table_id: 'SUPPLIER',
        record_id: supplierId,
        action_type: 'UPDATE',
        action_by: userId,
        changed_data: { before: oldRecord, after: newRecord }
    });
    
    return newRecord;
}
```

### 8. Querying Audit Logs

**View all changes to a specific record:**
```sql
SELECT * FROM log
WHERE table_id = (SELECT table_id FROM tracked_tables WHERE table_code = 'SUPPLIER')
  AND record_id = '123'
ORDER BY action_at DESC;
```

**View all actions by a user:**
```sql
SELECT l.*, t.table_name, u.display_id
FROM log l
JOIN tracked_tables t ON l.table_id = t.table_id
JOIN users u ON l.action_by = u.auth_id
WHERE l.action_by = '<user_uuid>'
ORDER BY l.action_at DESC;
```

**View recent changes:**
```sql
SELECT l.*, t.table_name
FROM log l
JOIN tracked_tables t ON l.table_id = t.table_id
WHERE l.action_at > NOW() - INTERVAL '7 days'
ORDER BY l.action_at DESC;
```

### 9. Permissions & Security

SchemaV02 grants appropriate permissions:
```sql
-- Sequences
GRANT USAGE, SELECT ON SEQUENCE seq_user_a, seq_user_m, seq_user_s TO authenticated, service_role;

-- Role table (read-only for users)
GRANT SELECT ON public.role TO authenticated, anon;

-- Users table
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- Log table (immutable audit trail)
GRANT SELECT ON public.log TO authenticated, service_role;
GRANT INSERT ON public.log TO service_role;  -- Only service role can log

-- Business tables (depends on row-level security policies)
-- These are implemented per table in your application queries
```

### 10. Implementation Checklist

- [ ] Run SchemaV02.txt in Supabase SQL editor
- [ ] Seed initial data (role table, tracked_tables)
- [ ] Create backend handlers for user registration
- [ ] Implement `createUserRecord()` function
- [ ] Add audit logging to all CRUD operations
- [ ] Create RLS (Row Level Security) policies for business tables
- [ ] Set up database query helper functions in backend
- [ ] Test user creation flow end-to-end
- [ ] Verify log entries are created correctly
- [ ] Set up monitoring/alerts for failed operations

- Sequences and tables must have proper permissions for the roles that might execute the function.

- USAGE, SELECT on sequences is required to call nextval().

- The public.role table needs SELECT so the function can query it.

- public.users is given full access to postgres and service_role (for admin tasks), while authenticated users (the ones who trigger the function) only get SELECT, INSERT, UPDATE – exactly what the trigger needs.


### 11. Verification Query
```
SELECT proname, prosecdef, proconfig 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```
- This checks that the function exists and that prosecdef is true (meaning it's a security definer) and proconfig shows the search path.

- Useful for debugging.


## How Display ID Generation Works – Step‑by‑Step
1. User signs up with role information sent via options.data in supabase.auth.signUp().

2. The handle_new_user trigger fires after the Auth user is created.

3. The function:
- Extracts the role from raw_user_meta_data.
- Looks up the corresponding role_code and role_id from the role table.
- Selects the appropriate sequence (seq_user_a, seq_user_m, or seq_user_s) and calls nextval() to get the next unique number for that role.
- Pads the number with leading zeros to 4 digits.
- Concatenates the role code with the padded number to form the display_id (e.g., 'A0012').
- Inserts the new user record into public.users with that display_id.

Result: Every user gets a distinct, human‑readable identifier that encodes their role and a sequential count within that role. For example:

- First staff user → S0001
- Second staff user → S0002
- First admin → A0001

---

## 🔐 Detailed Sequences Explanation - Deeper Dive

### What is a Sequence?

A sequence is a **special database object that generates sequential numbers**.

Like a **numbered ticket machine at a ticket counter:**
```
Person 1: Takes ticket → Gets 0001
Person 2: Takes ticket → Gets 0002
Person 3: Takes ticket → Gets 0003
```

### Why We Need Sequences?

**Option A: Without sequences (Bad) ❌**
```sql
SELECT COUNT(*) + 1 FROM users WHERE role_id = 1;
```
**Problem:** Race condition
- Person A & B both execute simultaneously
- Both count = 5
- Both try to create user with ID 5
- ❌ DUPLICATE ID found error or data corruption!

**Option B: With sequences (Good) ✓**
```sql
SELECT nextval('seq_user_a');
```
**Solution:** Atomic operation
- Person A calls nextval() → Database returns 5 (and advances pointer)
- Person B calls nextval() → Database returns 6 (pointer advanced again)
- ✓ No conflicts, guaranteed unique numbers
- Database guarantees atomicity = only one person gets each number

### Our Three Sequences

```sql
CREATE SEQUENCE seq_user_a START 1;   -- Admin sequence
CREATE SEQUENCE seq_user_m START 1;   -- Manager sequence
CREATE SEQUENCE seq_user_s START 1;   -- Staff sequence
```

### Why THREE Separate Sequences?

**Scenario: What If We Used ONE Sequence for All Roles?**
```
Admin registers      → Sequence returns 1 → A0001
Manager registers    → Sequence returns 2 → M0002  ← Wrong! Not M0001
Admin registers      → Sequence returns 3 → A0003  ← Wrong! Skipped A0002
Manager registers    → Sequence returns 4 → M0004  ← Wrong! Skipped M0003
```
- Admin IDs: A0001, A0003, A0005... (not sequential!)
- Manager IDs: M0002, M0004... (not sequential!)
- Looks unprofessional: "Is this admin #2 or #1?"
- Hard to count: "How many admins do we have?" (have to count gaps)

**Scenario: With Separate Sequences (Our Approach) ✓**
```
Admin registers      → seq_user_a returns 1 → A0001
Manager registers    → seq_user_m returns 1 → M0001
Admin registers      → seq_user_a returns 2 → A0002
Manager registers    → seq_user_m returns 2 → M0002
```
- Admin IDs: A0001, A0002, A0003... (perfect sequence!)
- Manager IDs: M0001, M0002, M0003... (perfect sequence!)
- Staff IDs: S0001, S0002, S0003... (perfect sequence!)
- ✓ Clean, professional, role-specific numbering
- ✓ Easy to count: "We have 238 staff (S0001 to S0238)"

---

## 📊 Database Relationships Diagram

```
                    ┌─────────────────────────────────┐
                    │      Supabase Auth              │
                    │  (External - Passwords, etc)    │
                    │  ├─ Email                       │
                    │  ├─ Password Hash               │
                    │  └─ id (UUID) ◄──┐              │
                    └─────────────────────────────────┘
                                        │
                                        │ REFERENCES
                                        │
        ╔══════════════════════════════════════════════════╗
        ║              Users Table                         ║
        ║  PRIMARY KEY: auth_id (UUID)                    ║
        ║  ├─ auth_id ─────────────┐                      ║
        ║  ├─ email                 │ FOREIGN KEY         ║
        ║  ├─ first_name            ├─► auth.users(id)    ║
        ║  ├─ last_name             │                     ║
        ║  ├─ display_id (A0001)    │                     ║
        ║  ├─ role_id ──────────────┼─┐                   ║
        ║  ├─ log_id ────────────────┼─┤                   ║
        ║  ├─ created_at             │ │                   ║
        ║  └─ updated_at             │ │                   ║
        ╚════════════════════════════════════════════════════╝
                                  │   │
                       REFERENCES │   │ REFERENCES
                                  ▼   ▼
            ┌──────────────────┐ ┌──────────────────────┐
            │  Role Table      │ │  Log Table           │
            ├──────────────────┤ ├──────────────────────┤
            │ role_id (PK) ◄──│ │ log_id (PK)          │
            │ role_type        │ │ table_id ────┐       │
            │ role_code        │ │ record_id    │       │
            │ 1: admin (A)     │ │ action_type  │       │
            │ 2: manager (M)   │ │ ├─ INSERT    │       │
            │ 3: staff (S)     │ │ ├─ UPDATE    │       │
            └──────────────────┘ │ └─ DELETE    │       │
                                 │ action_at    │       │
                                 │ action_by ──►│ REFERENCES
                                 │ changed_data │ users.auth_id
                                 │ table_id ────┼─┐     │
                                 └──────────────┘ │     │
                                      ▲           │     │
                                      │       REFERENCES│
                                      │ REFERENCES    │
                                      │           ▼     │
                              ┌─────────────────────┐   │
                              │ Tracked Tables      │   │
                              ├─────────────────────┤   │
                              │ table_id (PK) ◄────┼───┘
                              │ table_name          │
                              │ table_code          │
                              │ ─────────────────   │
                              │ 1: users            │
                              │ 2: supplier         │
                              │ 3: customer         │
                              │ 4: inventory        │
                              │ 5: tax              │
                              │ 6: liabilities      │
                              │ 7: bank_acc         │
                              │ 8: contact_info     │
                              │ 9: classification   │
                              │ 10: quantity        │
                              └─────────────────────┘


Business Entities (All have log_id that points to Log table):

        ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
        │   Supplier   │      │   Customer   │      │  Inventory   │
        ├──────────────┤      ├──────────────┤      ├──────────────┤
        │supplier_id   │      │customer_id   │      │inventory_id  │
        │company       │      │company       │      │product_name  │
        │tax_id ──────┐│      │tax_id ──────┐│      │sku           │
        │bank_id ─┐   ││      │bank_id ─┐   ││      │qty_on_hand   │
        │contact_id┼──││┐     │contact_id┼──││┐     │reorder_level │
        │liabilities│ │││     │liabilities│ │││     │unit_cost     │
        │log_id    │ │││     │log_id    │ │││     │log_id        │
        └──────────────┘│     └──────────────┘│     └──────────────┘
                   │    │            │    │              │
                   └────┼────────────┘    │              │
                        │                 │              │
        ┌───────────────────────────────────────────────────────┐
        │                    │                  │                │
        ▼                    ▼                  ▼                ▼
    ┌─────────┐        ┌──────────┐     ┌─────────────┐    ┌──────────────┐
    │   Tax   │        │Bank_Acc  │     │Contact_Info │    │Classification│
    ├─────────┤        ├──────────┤     ├─────────────┤    ├──────────────┤
    │tax_id   │        │bank_id   │     │contact_id   │    │class_id      │
    │BRN      │        │bank_name │     │email        │    │class_code    │
    │TIN      │        │acc_no    │     │phone        │    │title         │
    │log_id   │        │acc_name  │     │address      │    │log_id        │
    └─────────┘        │status    │     │country      │    └──────────────┘
                       │log_id    │     │city         │
                       └──────────┘     │log_id       │
                                        └─────────────┘

                    ┌──────────────────┐
                    │  Liabilities     │
                    ├──────────────────┤
                    │liabilities_id    │
                    │credit_terms      │
                    │credit_limit      │
                    │allow_exceed_limit│
                    │invoice_date      │
                    │log_id            │
                    └──────────────────┘
```

### Key Connection Points Explained:

1. **Users ↔ Auth.users**: Foreign key link to Supabase authentication
2. **Users ↔ Role**: Each user has ONE role (admin, manager, or staff)
3. **Users ↔ Log**: When user is created, insertion is recorded in log
4. **All Business Tables ↔ Log**: Every INSERT/UPDATE/DELETE on business tables is logged
5. **Log ↔ Users**: Records which user performed the action
6. **Log ↔ Tracked Tables**: Records which table was affected
7. **Supplier/Customer ↔ Tax/Bank/Contact/Liabilities**: Store related information

---

## 🔒 Permissions & Security - Who Can Do What?

### Permission Levels

```sql
-- SEQUENCES: Used to generate display IDs
GRANT USAGE, SELECT ON SEQUENCE seq_user_a, seq_user_m, seq_user_s 
  TO authenticated, service_role;

-- ROLE TABLE: Information about roles (read-only for users)
GRANT SELECT ON public.role 
  TO authenticated, anon;
GRANT ALL ON public.role 
  TO service_role;

-- USERS TABLE: Personal data management
GRANT SELECT, INSERT, UPDATE ON public.users 
  TO authenticated;         -- Users can read/update their own
GRANT ALL ON public.users 
  TO service_role;          -- Service role has full access

-- LOG TABLE: Immutable audit trail
GRANT SELECT ON public.log 
  TO authenticated, service_role;
GRANT INSERT ON public.log 
  TO service_role;          -- Only service role can INSERT logs
-- NO DELETE or UPDATE permissions = logs are immutable!
```

### Permission Matrix

| Who | Can Read | Can Insert | Can Update | Can Delete |
|-----|----------|-----------|-----------|-----------|
| **Regular User** | Users table (own record), Role table, Log table (read-only) | ✓ Self-registration | ✓ Update own profile | ❌ Never |
| **Admin** | Everything | ✓ All tables | ✓ All tables | ✓ Business data only |
| **App Backend** | Everything | ✓ All tables | ✓ All tables | ✓ All tables |
| **Sequence** | - | ✓ Can call nextval() | - | - |
| **Log Table** | ✓ Can select | ✓ Only INSERT | ❌ NO UPDATE | ❌ NO DELETE |

**Key Security Principle:**
- **Log table is immutable** = Once an entry is written, it CANNOT be changed or deleted
- This ensures audit trail integrity = nobody can cover their tracks!
- If a mistake is logged, you create a new corrective entry, not delete the original

---

## ❓ Common Questions & Troubleshooting

### Q1: "What's the difference between auth_id and display_id?"

| Aspect | auth_id | display_id |
|--------|---------|-----------|
| **Format** | UUID (complex) | Role + Number (simple) |
| **Example** | 550e8400-e29b-41d4-a716-446655440000 | A0001 |
| **Purpose** | Database relationships, security | Human communication |
| **Used By** | System, database queries | Reports, dashboards, emails |
| **Memorability** | Hard to remember | Easy to remember |
| **Uniqueness** | Globally unique | Unique per role |

**Analogy:**
- **auth_id** = Social Security Number (for government/systems)
- **display_id** = Employee ID badge (for the office)

You need both: one for security, one for convenience!

### Q2: "Can I change someone's display_id?"

Generally **NO** - display_id should be immutable (unchangeable).

**Why?**
- If you change it, historical logs become confusing: "Did A0001 do this action or did someone reassigned to that number?"
- Violates audit trail integrity

**If you absolutely must:**
1. Deactivate the old ID
2. Create a new user record with new ID
3. Update all references
4. Create log entry documenting the reason
5. Keep old record for audit purposes

**Best practice:** Treat display_id like an employee badge number - permanent!

### Q3: "The log table is growing huge! How do I manage it?"

**Solution: Archive old logs**

```sql
-- Create archive table (same structure as log)
CREATE TABLE log_archive AS SELECT * FROM log WHERE 1=0;

-- Archive logs older than 1 year
INSERT INTO log_archive 
SELECT * FROM log 
WHERE action_at < NOW() - INTERVAL '1 year';

-- Delete archived logs from active table
DELETE FROM log 
WHERE action_at < NOW() - INTERVAL '1 year';

-- This keeps active log table fast and queryable
-- Archive stays for long-term compliance/analysis
```

**Indexes** (already in SchemaV02, but verify):
```sql
-- These make queries fast even on large logs
CREATE INDEX idx_log_table_record_time ON log(table_id, record_id, action_at DESC);
CREATE INDEX idx_log_action_at ON log(action_at);
```

### Q4: "What if I need to track more tables?"

Easy! Just add to `tracked_tables`:

```sql
INSERT INTO tracked_tables (table_name, table_code) VALUES ('my_new_table', 'MY_TABLE');
```

Then implement logging in your backend for that table:
```typescript
// When inserting into my_new_table
await logAction('MY_TABLE', recordId, 'INSERT', userId, changedData);
```

No database schema changes needed!

### Q5: "What if a sequence gets corrupted?"

Reset a sequence:

```sql
-- Reset sequence to start fresh
ALTER SEQUENCE seq_user_a RESTART WITH 1;

-- Or set to match current IDs
SELECT setval('seq_user_a', 
    MAX(CAST(SUBSTRING(display_id, 2) AS INTEGER))
) FROM users WHERE role_id = 1;
```

### Q6: "Database performance is degrading, how to optimize?"

1. **Use indexes** (already in place):
   ```sql
   ANALYZE log;  -- Analyze table statistics
   ```

2. **Archive old data** (see Q3)

3. **Vacuum & Reindex**:
   ```sql
   VACUUM ANALYZE log;
   REINDEX TABLE log;
   ```

4. **Partition large logs** (advanced):
   ```sql
   -- Create monthly partitions for 1000000+ records
   SELECT pg_partman.create_parent('public.log', 'action_at', 'native', 'monthly');
   ```

---

## 📋 Complete Implementation Checklist

### Phase 1: Database Setup
- [ ] Copy **all SQL** from SchemaV02.txt
- [ ] Open Supabase SQL Editor
- [ ] Paste SQL and execute
- [ ] Verify no errors in output

### Phase 2: Data Verification
- [ ] [ ] `SELECT * FROM role;` → Should return 3 rows (admin, manager, staff)
- [ ] [ ] `SELECT * FROM tracked_tables;` → Should return 10 rows
- [ ] [ ] `\ds` → Verify sequences exist (seq_user_a, seq_user_m, seq_user_s)
- [ ] [ ] `SELECT nextval('seq_user_a');` → Should return 1
- [ ] [ ] `SELECT nextval('seq_user_m');` → Should return 1
- [ ] [ ] `SELECT nextval('seq_user_s');` → Should return 1

### Phase 3: Backend Implementation
- [ ] Create `/server/src/services/userService.ts`
- [ ] Implement `createUserRecord()` function
- [ ] Add error handling (try-catch with rollback)
- [ ] Test with manual API call

### Phase 4: Implement Audit Logging
- [ ] Create `logService.ts` for centralized logging
- [ ] Add logging to **CREATE** operations (INSERT)
- [ ] Add logging to **UPDATE** operations (before/after capture)
- [ ] Add logging to **DELETE** operations
- [ ] Add logging to **READ** operations (optional but recommended)

### Phase 5: Integration Testing
- [ ] [ ] Register test user → Verify `display_id` created correctly
- [ ] [ ] Check users table: `SELECT * FROM users WHERE email = 'test@example.com';`
- [ ] [ ] Check log table: `SELECT * FROM log WHERE table_id = 1 ORDER BY log_id DESC LIMIT 1;`
- [ ] [ ] Modify user → Verify log captures before/after
- [ ] [ ] Query audit log using example queries below

### Phase 6: Frontend Integration
- [ ] Display user's `display_id` in dashboard
- [ ] Show `display_id` in reports
- [ ] Display role information from `role` table

### Phase 7: Monitoring Setup
- [ ] Set up application logging middleware
- [ ] Create dashboard showing recent audit entries
- [ ] Set up alerts for suspicious activity (mass deletes, errors)
- [ ] Schedule weekly audit log review

### Phase 8: Documentation
- [ ] Document all custom logging functions
- [ ] Create team runbook for troubleshooting
- [ ] Train team on audit log queries

---

## 📚 Summary - The Big Picture

| Component | Purpose | Why Important | Real-World Use |
|-----------|---------|---------------|----------------|
| **Supabase Auth** | Handle passwords & login | Security, compliance | "John just signed up" |
| **Users Table** | Store user info & assignments | Know who is in system | "John is an admin" |
| **Role Table** | Define role types | Manage permissions | "Admin can do X, managers can do Y" |
| **Sequences** | Auto-generate display IDs | Professional, continuous numbering | User badge numbers: A0001, A0002... |
| **Log Table** | Record all changes | Accountability, debugging, compliance | "Mary changed supplier #15 on Jan 15" |
| **Business Tables** | Store company data | Core ERP operations | Suppliers, customers, inventory, taxes |
| **Tracked Tables** | Catalog what to monitor | Flexible audit system | Add new table to monitor → just add a row |

### In One Sentence:
**"SchemaV02 is a secure, auditable ERP database where users are created reliably by the backend application (not database triggers), every change is logged permanently with before/after values, and complete data integrity is guaranteed through sequences, foreign keys, and immutable audit trails."**

### Key Principles:
1. ✅ **Reliability** - Backend controls user creation, not unreliable triggers
2. ✅ **Accountability** - Every action is logged forever
3. ✅ **Integrity** - Sequences guarantee unique numbers, foreign keys enforce consistency
4. ✅ **Security** - Immutable logs, proper permission levels, audit trails
5. ✅ **Scalability** - Can track unlimited tables, logs can be archived
6. ✅ **Compliance** - Full audit trails for regulatory requirements

---

## 🚀 Quick Reference Commands

```sql
-- Check all users
SELECT auth_id, email, display_id, role_id, created_at FROM users;

-- Get next display_id that will be assigned
SELECT nextval('seq_user_a'), nextval('seq_user_m'), nextval('seq_user_s');

-- See recent changes
SELECT * FROM log ORDER BY log_id DESC LIMIT 10;

-- Find all actions by a user
SELECT l.*, t.table_name 
FROM log l 
JOIN tracked_tables t ON l.table_id = t.table_id
WHERE l.action_by = '<user_uuid>'
ORDER BY l.action_at DESC;

-- Count operations by type
SELECT action_type, COUNT(*) as count FROM log GROUP BY action_type;

-- Most active user
SELECT u.display_id, COUNT(*) as actions
FROM log l
JOIN users u ON l.action_by = u.auth_id
GROUP BY u.display_id
ORDER BY actions DESC LIMIT 10;
```

---