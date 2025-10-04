const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./database");

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "mysecretkey123";

// Create users table if it doesn't exist
const createTableQuery = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

pool.query(createTableQuery)
  .then(() => console.log('✅ Users table ready'))
  .catch(err => console.error('❌ Error creating table:', err));

// Test route
app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// Signup Route
app.post("/signup", async (req, res) => {
  console.log("📥 Signup request received:", req.body);
  
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    // Check if user already exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );

    console.log("✅ User created successfully:", result.rows[0]);
    res.status(201).json({ 
      message: "User created successfully",
      user: result.rows[0]
    });

  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({ message: "Error creating user", error: error.message });
  }
});

// Login Route
app.post("/login", async (req, res) => {
  console.log("📥 Login request received:", req.body);
  
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Find user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("✅ Login successful for:", user.email);
    res.json({ 
      message: "Login successful", 
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });

  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// Start server
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});