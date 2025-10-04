// database.js - PostgreSQL Connection
const { Pool } = require('pg');

const pool = new Pool({
  user: 'rupali',      // e.g., 'postgres'
  host: 'localhost',
  database: 'rotelearning_app',        // your database name
  password: 'RUPAli@123',
  port: 5432,                          // default PostgreSQL port
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to PostgreSQL:', err.stack);
  } else {
    console.log('✅ PostgreSQL connected successfully');
    release();
  }
});

module.exports = pool;