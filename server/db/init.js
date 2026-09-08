/**
 * db/init.js
 * Initialises the PostgreSQL database by running schema.sql.
 * Usage:
 *   npm run db:init          → create tables (safe, uses IF NOT EXISTS)
 *   npm run db:reset         → drop all tables then recreate
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = require('pg');
const fs   = require('fs');

const isReset = process.argv.includes('--reset');

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME     || 'vulnora',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });

async function init() {
  const client = await pool.connect();
  try {
    if (isReset) {
      console.log('⚠️  Resetting database — dropping all tables…');
      await client.query(`
        DROP TABLE IF EXISTS ai_remediations CASCADE;
        DROP TABLE IF EXISTS findings        CASCADE;
        DROP TABLE IF EXISTS recon_results   CASCADE;
        DROP TABLE IF EXISTS scans           CASCADE;
        DROP VIEW  IF EXISTS scan_summary    CASCADE;
      `);
      console.log('✅ Tables dropped.');
    }

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema     = fs.readFileSync(schemaPath, 'utf8');

    await client.query(schema);
    console.log('✅ Database schema applied successfully.');
    console.log('   Tables: scans, recon_results, findings, ai_remediations');
    console.log('   View:   scan_summary');
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

init();
