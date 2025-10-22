// database.js - PostgreSQL Connection
require("dotenv").config(); // Load environment variables
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Error connecting to PostgreSQL:", err.stack);
  } else {
    console.log("✅ PostgreSQL connected successfully");
    release();
  }
});

module.exports = pool;
