import express from 'express';

const router = express.Router();

// Temporary routes for testing
router.post('/register', (req, res) => {
  res.json({ message: 'Register endpoint - ready for implementation' });
});

router.post('/login', (req, res) => {
  res.json({ message: 'Login endpoint - ready for implementation' });
});

export default router;