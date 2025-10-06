const express = require("express");
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./database");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = "mysecretkey123";
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
const upload = multer({ dest: "uploads/" });

// Create users table if it doesn't exist
const createUserTable = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`;

const createNotesTable = `
  CREATE TABLE IF NOT EXISTS notes(
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    topic VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`;

// Create Users table first
pool.query(createUserTable)
  .then(() => {
    console.log("✅ Users table ready");
    return pool.query(createNotesTable);
  })
  .then(() => {
    console.log("✅ Notes table ready");
  })
  .catch(err => {
    console.error("❌ Error creating tables:", err);
  });

// Test route
app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// Signup Route
app.post("/signup", async (req, res) => {
  console.log("🔥 Signup request received:", req.body);
  
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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
  console.log("🔥 Login request received:", req.body);
  
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

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

app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("📥 ========== UPLOAD REQUEST START ==========");
  console.log("📦 Request body:", req.body);
  console.log("📄 File info:", req.file);
  
  const { topic, userId } = req.body;

  // Validation
  if (!userId) {
    console.log("❌ No userId provided");
    return res.status(400).json({ message: "User ID is required" });
  }
  
  if (!topic && !req.file) {
    console.log("❌ No topic or file provided");
    return res.status(400).json({ message: "Either topic or file is required" });
  }

  try {
    let textContent = "";

    if (req.file) {
      const filePath = path.resolve(req.file.path);
      console.log("📁 Processing file at path:", filePath);
      console.log("📁 File exists:", fs.existsSync(filePath));

      try {
        console.log("🔍 Calling Google Vision API...");
        const [result] = await client.textDetection(filePath);
        console.log("✅ Vision API response received");
        
        const detections = result.textAnnotations;
        console.log("📝 Text annotations found:", detections ? detections.length : 0);
        
        textContent = detections && detections[0] 
          ? detections[0].description 
          : "No text detected.";
        
        console.log("📝 Extracted text length:", textContent.length);
        console.log("📝 First 100 chars:", textContent.substring(0, 100));
        
      } catch (visionError) {
        console.error("❌ Google Vision API Error:", visionError);
        console.error("❌ Error message:", visionError.message);
        console.error("❌ Error stack:", visionError.stack);
        throw new Error(`Vision API failed: ${visionError.message}`);
      } finally {
        // Delete file after processing (or after error)
        try {
          fs.unlinkSync(filePath);
          console.log("🗑️  Temporary file deleted");
        } catch (deleteError) {
          console.error("⚠️  Could not delete temp file:", deleteError.message);
        }
      }
    } else if (topic) {
      textContent = `Generated content for topic: ${topic}`;
      console.log("📝 Using topic-based content");
    }

    console.log("💾 Inserting into database...");
    console.log("💾 userId:", userId, "topic:", topic);
    
    const dbResult = await pool.query(
      "INSERT INTO notes(user_id, topic, content) VALUES ($1, $2, $3) RETURNING id",
      [userId, topic || "Untitled", textContent]
    );
    
    console.log("✅ Database insert successful, note id:", dbResult.rows[0].id);
    console.log("========== UPLOAD REQUEST END ==========");

    res.json({ 
      message: "Notes uploaded successfully!", 
      content: textContent.substring(0, 200), // Send first 200 chars
      noteId: dbResult.rows[0].id
    });

  } catch (error) {
    console.error("❌ ========== UPLOAD ERROR ==========");
    console.error("❌ Error type:", error.constructor.name);
    console.error("❌ Error message:", error.message);
    console.error("❌ Error stack:", error.stack);
    console.error("========================================");
    
    res.status(500).json({ 
      message: "Upload failed", 
      error: error.message,
      errorType: error.constructor.name
    });
  }
});

// Start server
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
  console.log("🔑 Environment check:");
  console.log("   GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS);
});