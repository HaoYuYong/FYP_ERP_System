import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Import database connection
import { pool } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import inventoryRoutes from './routes/inventory';
import customerRoutes from './routes/customer';
import supplierRoutes from './routes/supplier';
import purchaseRequestRoutes from './routes/purchase-request';
import purchaseOrderRoutes from './routes/purchase-order';
import companySettingsRoutes from './routes/company-settings';
import quotationRoutes from './routes/quotation';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/purchase-request', purchaseRequestRoutes);
app.use('/api/purchase-order', purchaseOrderRoutes);
app.use('/api/company-settings', companySettingsRoutes);
app.use('/api/quotation', quotationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ERP Server is running' });
});

// Test database connection on startup
const testDatabaseConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to Supabase PostgreSQL database');
    client.release(); // Important: release the client back to pool
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  }
};

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await testDatabaseConnection();
});