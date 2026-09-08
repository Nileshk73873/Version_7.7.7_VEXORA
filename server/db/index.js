/**
 * db/index.js
 * PostgreSQL connection pool — shared across all modules.
 * Uses the `pg` library with environment-configured settings.
 */

require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME     || 'websec_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max:      10,          // max pool connections
  idleTimeoutMillis:    30000,
  connectionTimeoutMillis: 5000,
});

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
