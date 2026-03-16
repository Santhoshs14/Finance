require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Initialize Firebase (must be before routes)
require('./config/firebase');

const app = express();

// =========================
// Security Middleware
// =========================
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// =========================
// Rate Limiting
// =========================
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per 15 minutes
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth', apiLimiter);

// =========================
// Input Sanitization
// =========================
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj, depth = 0) => {
    if (depth > 10) return obj; // Prevent stack overflow from deep objects
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/<[^>]*>/g, ''); // Strip HTML tags
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key], depth + 1);
      }
    }
    return obj;
  };
  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  next();
};
app.use(sanitizeInput);

// =========================
// Routes
// =========================
app.use('/auth', require('./routes/authRoutes'));
app.use('/accounts', require('./routes/accountRoutes'));
app.use('/transactions', require('./routes/transactionRoutes'));
app.use('/budgets', require('./routes/budgetRoutes'));
app.use('/credit-cards', require('./routes/creditCardRoutes'));
app.use('/investments', require('./routes/investmentRoutes'));
app.use('/mutual-funds', require('./routes/mutualFundRoutes'));
app.use('/goals', require('./routes/goalRoutes'));
app.use('/lending', require('./routes/lendingRoutes'));
app.use('/reports', require('./routes/reportRoutes'));
app.use('/import', require('./routes/importRoutes'));
app.use('/insights', require('./routes/insightsRoutes'));
app.use('/calculations', require('./routes/calculationsRoutes'));

// Health check
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'WealthFlow API is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, data: null, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// =========================
// Error Handler
// =========================
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// =========================
// Start Server
// =========================
const { startCronJobs } = require('./services/cronService');
startCronJobs();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 WealthFlow API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Login:  POST http://localhost:${PORT}/auth/login\n`);
});

module.exports = app;
