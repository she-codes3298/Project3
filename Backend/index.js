// =======================
// IMPORTS
// =======================
require("dotenv").config();
const aiRouter = require('./routes/ai');
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./database");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


// =======================
// EXPRESS APP SETUP
// =======================
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// mount ai routes after app is defined
app.use('/api/ai', aiRouter);

// =======================
// GOOGLE VISION SETUP
// =======================

// Path to service account key
const keyPath = path.join(__dirname, "vision-key-user.json");

// Ensure the key file exists before creating auth/client
if (!fs.existsSync(keyPath)) {
  console.error("❌ Google Vision key file not found at:", keyPath);
  process.exit(1);
} else {
  console.log("✅ Vision key file found at:", keyPath);
}

const vision = require('@google-cloud/vision');
const { GoogleAuth } = require('google-auth-library');

const auth = new GoogleAuth({
  keyFile: keyPath,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});

const client = new vision.ImageAnnotatorClient({ auth });
console.log("🔑 Google Vision auth initialized successfully");

// =======================
// DATABASE TABLE CREATION
// =======================
const createUserTable = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

const createNotesTable = `
  CREATE TABLE IF NOT EXISTS notes(
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    topic VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

pool
  .query(createUserTable)
  .then(() => {
    console.log("✅ Users table ready");
    return pool.query(createNotesTable);
  })
  .then(() => {
    console.log("✅ Notes table ready");
  })
  .catch((err) => {
    console.error("❌ Error creating tables:", err);
  });

// Add JWT secret and upload configuration
// (ensures JWT_SECRET and `upload` are available where used)
const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey123";

// Ensure uploads directory exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Configure multer for multiple files (limit 5)
const upload = multer({ dest: "uploads/" });

// =======================
// ROUTES
// =======================

// Test Route
app.get("/test", (req, res) => {
  res.json({ message: "Backend is working!" });
});

// -----------------------
// SIGNUP
// -----------------------
app.post("/signup", async (req, res) => {
  console.log("🔥 Signup request received:", req.body);

  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const userExists = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashedPassword]
    );

    console.log("✅ User created successfully:", result.rows[0]);
    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error creating user:", error);
    res.status(500).json({ message: "Error creating user", error: error.message });
  }
});

// -----------------------
// LOGIN
// -----------------------
app.post("/login", async (req, res) => {
  console.log("🔥 Login request received:", req.body);

  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(400).json({ message: "User not found" });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "1h",
    });

    console.log("✅ Login successful for:", user.email);
    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("❌ Error logging in:", error);
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
});

// -----------------------
// UPLOAD MULTIPLE IMAGES WITH TEXT EXTRACTION
// -----------------------
// -----------------------
// UPLOAD MULTIPLE IMAGES WITH TEXT EXTRACTION (LIMIT 5 FILES)
// -----------------------
// -----------------------
// UPLOAD MULTIPLE IMAGES AS SINGLE NOTE ENTRY
// -----------------------
app.post("/upload", upload.array("files", 5), async (req, res) => {
  console.log("🔥 Upload request received");
  const { topic, userId } = req.body;

  if (!userId) return res.status(400).json({ message: "User ID is required" });
  if (!topic && (!req.files || req.files.length === 0)) {
    return res.status(400).json({ message: "Please upload at least one file or provide a topic" });
  }

  const filePaths = [];
  let combinedText = "";

  try {
    // 1️⃣ Extract text from all uploaded images
    if (req.files && req.files.length > 0) {
      console.log(`📸 Processing ${req.files.length} file(s)...`);

      for (const file of req.files) {
        const filePath = path.resolve(file.path);
        filePaths.push(filePath);

        if (!fs.existsSync(filePath)) continue;

        try {
          const [result] = await client.textDetection(filePath);
          const detections = result.textAnnotations;

          const text = detections && detections.length > 0
            ? detections[0].description.trim()
            : "No text detected in this image.";

          combinedText += `\n\n--- [${file.originalname}] ---\n${text}`;
          console.log(`✅ Extracted text from: ${file.originalname}`);
        } catch (err) {
          console.error(`❌ Vision API error for ${file.originalname}:`, err.message);
        }
      }
    }

    // 2️⃣ Create one single DB entry per upload batch
    if (combinedText.trim() === "" && topic) {
      combinedText = `Notes for topic: ${topic}`;
    }

    const dbResult = await pool.query(
      "INSERT INTO notes (user_id, topic, content) VALUES ($1, $2, $3) RETURNING *",
      [userId, topic || "Uploaded Files", combinedText.trim()]
    );

    const note = dbResult.rows[0];
    console.log("✅ Combined note saved to database:", note.id);

    // 3️⃣ Send extracted text to OpenAI for confirmation
    if (typeof fetch === "function") {
      try {
        const aiResponse = await fetch("http://localhost:5000/api/ai/send-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [combinedText],
            prompt: "Please confirm that you received this extracted content.",
          }),
        });

        // Robust parsing & logging
        const contentType = aiResponse.headers.get?.("content-type") || "";
        let aiData;
        if (contentType.includes("application/json")) {
          aiData = await aiResponse.json();
        } else {
          const textBody = await aiResponse.text();
          try { aiData = JSON.parse(textBody); } catch { aiData = { text: textBody }; }
        }

        console.log("🤖 AI response status:", aiResponse.status, aiResponse.statusText);
        console.log("🤖 AI response body:", aiData);

        // Handle error-shaped responses (e.g. { error: 'OpenAI error', details: '...json...' })
        let assistant = null;
        if (aiData?.error) {
          // Extract a useful error message
          let errorMessage = typeof aiData.error === "string" ? aiData.error : (aiData.error.message || JSON.stringify(aiData.error));
          if (aiData?.details && typeof aiData.details === "string") {
            try {
              const parsedDetails = JSON.parse(aiData.details);
              const parsedMsg = parsedDetails?.error?.message || parsedDetails?.message;
              if (parsedMsg) errorMessage = parsedMsg;
              console.log("🤖 Parsed AI error details:", parsedDetails);
            } catch (parseErr) {
              // details wasn't JSON — keep as-is
              errorMessage = aiData.details;
            }
          }
          console.warn("⚠️ AI returned an error:", errorMessage);
          assistant = `AI error: ${errorMessage}`; // fallback so assistant isn't undefined
        } else {
          // Try multiple common locations for assistant text
          assistant =
            aiData?.assistant ||
            aiData?.message ||
            aiData?.data ||
            aiData?.result ||
            (aiData?.choices && aiData.choices[0]?.message?.content) ||
            (aiData?.choices && aiData.choices[0]?.text) ||
            aiData?.text ||
            null;
        }

        if (assistant) {
          console.log("🤖 Assistant text:", assistant);
        } else {
          console.warn("⚠️ Assistant content not found in AI response. Check the full response above for structure.");
        }
      } catch (aiError) {
        console.error("❌ Error sending content to AI:", aiError.message);
      }
    } else {
      console.warn("⚠️ fetch is not available in this Node runtime — skipping AI forwarding step");
    }

    // 4️⃣ Send final response to frontend
    res.json({
      message: "Upload successful!",
      uploadedCount: req.files ? req.files.length : 0,
      noteId: note.id,
      note,
    });

  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  } finally {
    // 4️⃣ Clean up uploaded files
    filePaths.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted temp file: ${filePath}`);
      }
    });
  }
});

// -----------------------
// FETCH NOTES
// -----------------------
app.get("/notes/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM notes WHERE user_id = $1 ORDER BY uploaded_at DESC",
      [userId]
    );
    res.json({ notes: result.rows });
  } catch (error) {
    console.error("❌ Error fetching notes:", error);
    res.status(500).json({ message: "Error fetching notes", error: error.message });
  }
});

// =======================
// START SERVER
// =======================
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
  console.log("🔑 Google Vision credentials loaded from:", keyPath);
  console.log("📸 Multiple file upload enabled (max 5 files per request)");
});

module.exports = app;