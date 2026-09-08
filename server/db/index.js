const path = require('path');
const fs = require('fs');
require('dotenv').config();
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}
const { Pool } = require('pg');
const logger = require('../utils/logger');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }  // Required for Render/Heroku/Neon/Supabase
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

// Verify connection and automatically initialize schema on startup
pool.connect(async (err, client, release) => {
  if (err) {
    logger.error('❌ PostgreSQL connection failed:', err.message);
  } else {
    logger.info('✅ PostgreSQL connected successfully');
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schema);
        logger.info('✅ Database schema verified / initialized');
      }
    } catch (schemaErr) {
      logger.error('Database auto-schema error:', schemaErr.message);
    } finally {
      release();
    }
  }
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err.message);
});

module.exports = pool;
