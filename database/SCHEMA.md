# Schema
## Copy SQL Command from SchemaV01 into Supabase SQL Editor, and run it there!

### 1. Drop and Recreate the Trigger Function with Proper Settings
```
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
...
$$ LANGUAGE plpgsql;
```

What is does: 
- DROP FUNCTION IF EXISTS ... CASCADE removes any existing version of the function to avoid conflicts. CASCADE also drops dependent objects (like triggers).

- CREATE OR REPLACE FUNCTION defines a new function.

- RETURNS TRIGGER indicates this function will be used as a trigger.

- SECURITY DEFINER – this crucial clause makes the function execute with the privileges of the owner (usually the Postgres role that created it), not the role that invoked the trigger (which would be the Supabase Auth user). This allows the function to insert into tables that the end user might not have direct permission to modify.

- SET search_path = public – Because the function runs with SECURITY DEFINER, it needs an explicit search path to avoid accidentally using the wrong schema (e.g., auth vs public). This ensures that all unqualified table names (like role, users) are resolved in the public schema.



### 2. Function Body – Variable Declarations
```
DECLARE
    v_role_type TEXT;
    v_role_id INTEGER;
    v_role_code CHAR(1);
    v_nextval BIGINT;
    v_display_id VARCHAR(20);
BEGIN
```

Variables are declared to hold intermediate values:

- v_role_type: the role name from metadata ('admin', 'manager', 'staff').

- v_role_id and v_role_code: the corresponding numeric ID and letter code from the role table.

- v_nextval: the next number from the role‑specific sequence.

- v_display_id: the final formatted display ID (e.g., 'A0012').



### 3. Extract Role from User Metadata
```
v_role_type := COALESCE(NEW.raw_user_meta_data->>'role', 'staff');
```

- NEW refers to the newly inserted row in auth.users.

- raw_user_meta_data is a JSONB column containing custom metadata set during sign‑up (e.g., via options.data in supabase.auth.signUp).

- COALESCE defaults to 'staff' if no role was provided.

Purpose: The role is taken from the registration form and stored in Auth metadata; this line extracts it for further processing.



### 4. Look Up Role Details from the role Table
```
SELECT role_id, role_code INTO v_role_id, v_role_code
FROM public.role
WHERE role_type = v_role_type;

IF NOT FOUND THEN
    SELECT role_id, role_code INTO v_role_id, v_role_code
    FROM public.role WHERE role_type = 'staff';
END IF;
```
- Queries the role table to get the numeric ID (role_id) and one‑letter code (role_code) corresponding to the role type.

- If the role type is not found (should not happen if seeded correctly), it falls back to 'staff'.

Why a separate role table?

- Normalization: role names and codes are stored centrally, making it easy to add/rename roles later.

- Avoids hard‑coding strings throughout the codebase.



### 5. Get Next Value from Role‑Specific Sequence
```
IF v_role_code = 'A' THEN
    SELECT nextval('public.seq_user_a') INTO v_nextval;
ELSIF v_role_code = 'M' THEN
    SELECT nextval('public.seq_user_m') INTO v_nextval;
ELSE
    SELECT nextval('public.seq_user_s') INTO v_nextval;
END IF;
```
- Uses PostgreSQL sequences to generate an ever‑increasing number independently per role.

- nextval('sequence_name') atomically increments the sequence and returns the new value.

- Three sequences (seq_user_a, seq_user_m, seq_user_s) were created earlier (in the full reset script) and start at 1.

Why sequences?

- Sequences are atomic and concurrency‑safe – multiple concurrent inserts will each get a unique, increasing number without locking.

- Unlike SERIAL on the whole table, separate sequences per role prevent gaps that could otherwise occur across roles (e.g., an admin registration won't consume a staff number).

- This ensures display IDs are gap‑free per role (e.g., staff IDs will be S0001, S0002, … even if many admins register in between).



### 6. Format the Display ID
```
v_display_id := v_role_code || LPAD(v_nextval::TEXT, 4, '0');
```

- v_role_code (e.g., 'A') is concatenated with the zero‑padded number.

- LPAD(v_nextval::TEXT, 4, '0') converts the number to a string and pads it with leading zeros to a width of 4 (so 1 becomes '0001', 12 becomes '0012').

- Example: role 'A', nextval = 12 → 'A0012'.

Padding ensures consistent, sortable display IDs.
If you expect more than 9999 users per role, simply increase the padding width (e.g., 5 digits).



### 7. Insert into the users Table
```
INSERT INTO public.users (auth_id, email, first_name, last_name, display_id, role_id)
VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    v_display_id,
    v_role_id
)
ON CONFLICT (auth_id) DO UPDATE
SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role_id = EXCLUDED.role_id,
    updated_at = NOW();
```

- auth_id is set to NEW.id (the UUID from auth.users). This establishes the foreign key relationship.

- COALESCE provides fallbacks for missing data.

- ON CONFLICT (auth_id) DO UPDATE handles the case where the user already exists (e.g., after an update to their Auth record). It updates their information while preserving the original display_id (unless the role changed, which could cause a new display ID – but typically the role shouldn't be changed after creation).

Note: The script updates display_id as well if there's a conflict, which could be problematic if a user's role changes after they already have an ID. In a real system, you might want to leave display_id unchanged if it already exists. This could be refined, but for an FYP it's acceptable.



### 8. Exception Handling
```
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user failed: % - %', SQLERRM, SQLSTATE;
        RETURN NEW;
```
- Any error in the function is caught, logged as a warning (visible in Postgres logs), but the trigger still returns NEW, allowing the Auth user creation to succeed even if the custom table insert fails.

- This prevents a failure in the trigger from blocking the user's sign‑up entirely. The user can still log in, and the inconsistency can be investigated later.



### 9. Recreate the Trigger
```
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

- The trigger is set to fire after a new row is inserted into auth.users. It runs the function for each inserted row.

- AFTER INSERT ensures the Auth user already exists; any failure in the trigger won't roll back the Auth insertion because it's after the event.



### 10. Grant Necessary Permissions
```
GRANT USAGE, SELECT ON SEQUENCE public.seq_user_a TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seq_user_m TO postgres, authenticated, anon, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.seq_user_s TO postgres, authenticated, anon, service_role;

GRANT SELECT ON public.role TO postgres, authenticated, anon, service_role;
GRANT ALL ON public.users TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
```

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