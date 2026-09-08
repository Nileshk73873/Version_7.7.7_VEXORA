/**
 * db/index.js
 * PostgreSQL connection pool — shared across all modules.
 *
 * Priority:
 *   1. DATABASE_URL  — single connection string (used in production / Render)
 *   2. Individual DB_* env vars — used for local development
 *
 * DATABASE_URL format:
 *   postgresql://username:password@host:port/dbname
 */

require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }  // Required for Render/Heroku
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME     || 'vulnora',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      max:      10,
      idleTimeoutMillis:    30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    logger.error('❌ PostgreSQL connection failed:', err.message);
  } else {
    logger.info('✅ PostgreSQL connected successfully');
    release();
  }
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = pool;
