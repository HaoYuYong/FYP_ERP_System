import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// SUPABASE CLIENT
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate Supabase config
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
}

// Export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// DIRECT POSTGRES CONNECTION
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false 
  } : false,
});

// // Test database connection
// pool.on('connect', () => {
//   console.log('✅ Connected to Supabase PostgreSQL database');
// });

// pool.on('error', (err) => {
//   console.error('❌ Database connection error:', err);
// });