/**
 * server.js
 * Express application entry point.
 * Configures middleware, routes, error handling, and starts the server.
 */

require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const logger      = require('./utils/logger');

// ── Route imports ─────────────────────────────────────────
const scanRoutes   = require('./routes/scan');
const reportRoutes = require('./routes/report');

const app  = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// ── Security middleware ───────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disable for API server
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ──────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.NODE_ENV === 'production' ? false : '*',
  methods:     ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request logging ───────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Global rate limiting ──────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      100,
  message:  { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

// ── Scan-specific rate limiting ───────────────────────────
const scanLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '3600000', 10),
  max:      parseInt(process.env.RATE_LIMIT_MAX || '10', 10),
  message:  { error: 'Scan limit reached. Maximum 10 scans per hour per IP.' },
  keyGenerator: (req) => req.ip,
});

// ── Static files (frontend) ───────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ────────────────────────────────────────────
app.use('/api/scan', scanRoutes); // Rate limiting removed for testing
app.use('/api/report', reportRoutes);

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
    env:       process.env.NODE_ENV || 'development',
  });
});

// ── Serve frontend for all non-API routes (SPA fallback) ──
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error('Unhandled error:', { message: err.message, stack: err.stack });
  res.status(err.status || 500).json({
    error:   err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// ── Start server ──────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 Vulnora Security Assessment Server running on http://localhost:${PORT}`);
  logger.info(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  logger.info(`   API Base    : http://localhost:${PORT}/api`);
  logger.info(`   Health      : http://localhost:${PORT}/api/health`);
});

module.exports = app;
