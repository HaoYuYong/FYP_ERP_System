import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// // Test database connection
// pool.on('connect', () => {
//   console.log('✅ Connected to Supabase PostgreSQL database');
// });

// pool.on('error', (err) => {
//   console.error('❌ Database connection error:', err);
// });