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
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// mount ai routes after app is defined
app.use('/api/ai', aiRouter);


const keyPath = path.join(__dirname, "vision-key-user.json");


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
const createTableSpaced_repetition=`CREATE TABLE IF NOT EXISTS spaced_repetition (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  note_id INT REFERENCES notes(id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL,
  difficulty_level INT CHECK (difficulty_level BETWEEN 1 AND 5),
  ease_factor DECIMAL(3,2) DEFAULT 2.5,
  repetition_count INT DEFAULT 0,
  interval_days INT DEFAULT 1,
  last_reviewed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_review_date TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, note_id)
);`;
const createTable_explain=`CREATE TABLE IF NOT EXISTS explanation_history (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  note_id INT REFERENCES notes(id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL,
  user_explanation TEXT NOT NULL,
  ai_feedback JSONB NOT NULL,
  understanding_score INT CHECK (understanding_score BETWEEN 0 AND 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

pool
  .query(createUserTable)
  .then(() => {
    console.log("✅ Users table ready");
    return pool.query(createNotesTable);
  })
  .then(() => {
    console.log("✅ Notes table ready");
    return pool.query(createTableSpaced_repetition);
  })
   .then(() => {
    console.log("✅Spaced_repetition table is ready");
    return pool.query(createTable_explain);
  })
   .then(() => {
    console.log("✅ explain table is ready");
  })
  .catch((err) => {
    console.error("❌ Error creating tables:", err);
  });

const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey123";


if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}


const upload = multer({ dest: "uploads/" });

function calculateNextReview(difficultyLevel, repetitionCount, easeFactor) {
  let intervalDays;
  let newEaseFactor = easeFactor;
  
 
  
  if (repetitionCount === 0) {
    
    const initialIntervals = {
      1: 7,   
      2: 5,   
      3: 3,   
      4: 2,   
      5: 1    
    };
    intervalDays = initialIntervals[difficultyLevel] || 3;
    
  } else if (repetitionCount === 1) {
    
    const secondIntervals = {
      1: 14,  
      2: 10,  
      3: 7,   
      4: 3,   
      5: 2    
    };
    intervalDays = secondIntervals[difficultyLevel] || 7;
    
  } else {
    
    const baseInterval = Math.pow(easeFactor, repetitionCount - 1) * 7;
    
    
    const difficultyMultiplier = {
      1: 2.5,   
      2: 2.0,   
      3: 1.5,   
      4: 1.0,   
      5: 0.6    
    }[difficultyLevel] || 1.5;
    
    intervalDays = Math.round(baseInterval * difficultyMultiplier);
  }
  
  
  if (difficultyLevel === 1) {
    newEaseFactor = Math.min(easeFactor + 0.15, 3.0);
  } else if (difficultyLevel === 2) {
    newEaseFactor = Math.min(easeFactor + 0.1, 2.8);
  } 
  
  else if (difficultyLevel === 3) {
    newEaseFactor = easeFactor;
  }
  
  else if (difficultyLevel === 4) {
    newEaseFactor = Math.max(easeFactor - 0.15, 1.3);
  } else if (difficultyLevel === 5) {
    newEaseFactor = Math.max(easeFactor - 0.2, 1.3);
  }
  

  
  
  intervalDays = Math.max(1, intervalDays);
  
  
  intervalDays = Math.min(intervalDays, 365);
  
  
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
  
  console.log(`📊 Calculated review: Difficulty=${difficultyLevel}, Rep=${repetitionCount}, Interval=${intervalDays}d, EaseFactor=${newEaseFactor.toFixed(2)}`);
  
  return {
    intervalDays,
    newEaseFactor: parseFloat(newEaseFactor.toFixed(2)),
    nextReviewDate: nextReviewDate.toISOString()
  };
}

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

    
    if (combinedText.trim() === "" && topic) {
      combinedText = `Notes for topic: ${topic}`;
    }

    const dbResult = await pool.query(
      "INSERT INTO notes (user_id, topic, content) VALUES ($1, $2, $3) RETURNING *",
      [userId, topic || "Uploaded Files", combinedText.trim()]
    );

    const note = dbResult.rows[0];
    console.log("✅ Combined note saved to database:", note.id);
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
// POST: Schedule/Update Review
// ===================================
app.post("/api/spaced-repetition/review", async (req, res) => {
  console.log("📅 Spaced repetition review request:", req.body);
  
  const { userId, noteId, topic, difficultyLevel } = req.body;
  
  // Validation
  if (!userId || !noteId || !difficultyLevel) {
    return res.status(400).json({ 
      message: "userId, noteId, and difficultyLevel are required" 
    });
  }
  
  if (difficultyLevel < 1 || difficultyLevel > 5) {
    return res.status(400).json({ 
      message: "difficultyLevel must be between 1 and 5" 
    });
  }
  
  try {
    // Check if review already exists
    const existingReview = await pool.query(
      "SELECT * FROM spaced_repetition WHERE user_id = $1 AND note_id = $2",
      [userId, noteId]
    );
    
    let result;
    
    if (existingReview.rows.length > 0) {
      // ===================================
      // UPDATE EXISTING REVIEW
      // ===================================
      const review = existingReview.rows[0];
      
      // Calculate next interval based on NEW difficulty level and CURRENT repetition count
      const { intervalDays, newEaseFactor, nextReviewDate } = calculateNextReview(
        difficultyLevel,
        review.repetition_count,  // Current count (will be incremented in DB)
        parseFloat(review.ease_factor)
      );
      
      result = await pool.query(
        `UPDATE spaced_repetition 
         SET difficulty_level = $1,
             ease_factor = $2,
             repetition_count = repetition_count + 1,
             interval_days = $3,
             last_reviewed = CURRENT_TIMESTAMP,
             next_review_date = $4
         WHERE user_id = $5 AND note_id = $6
         RETURNING *`,
        [difficultyLevel, newEaseFactor, intervalDays, nextReviewDate, userId, noteId]
      );
      
      console.log("✅ Updated existing review schedule");
      
    } else {
      // ===================================
      // CREATE NEW REVIEW SCHEDULE
      // ===================================
      const { intervalDays, newEaseFactor, nextReviewDate } = calculateNextReview(
        difficultyLevel,
        0,  // First review
        2.5 // Default starting ease factor
      );
      
      result = await pool.query(
        `INSERT INTO spaced_repetition 
         (user_id, note_id, topic, difficulty_level, ease_factor, repetition_count, interval_days, next_review_date)
         VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
         RETURNING *`,
        [userId, noteId, topic, difficultyLevel, newEaseFactor, intervalDays, nextReviewDate]
      );
      
      console.log("✅ Created new review schedule");
    }
    
    const review = result.rows[0];
    
    // Send response with clear information
    res.json({
      message: "Review scheduled successfully",
      intervalDays: review.interval_days,
      nextReview: review.next_review_date,
      nextReviewFormatted: new Date(review.next_review_date).toLocaleDateString(),
      repetitionCount: review.repetition_count,
      easeFactor: review.ease_factor,
      difficultyLevel: review.difficulty_level
    });
    
  } catch (error) {
    console.error("❌ Error scheduling review:", error);
    res.status(500).json({ 
      message: "Error scheduling review", 
      error: error.message 
    });
  }
});

// -----------------------
// GET: Fetch Due Reviews
// -----------------------
app.get("/api/spaced-repetition/due/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT sr.*, n.content 
       FROM spaced_repetition sr
       JOIN notes n ON sr.note_id = n.id
       WHERE sr.user_id = $1 
       AND sr.next_review_date <= CURRENT_TIMESTAMP
       ORDER BY sr.next_review_date ASC`,
      [userId]
    );
    
    console.log(`📚 Found ${result.rows.length} due reviews for user ${userId}`);
    
    res.json({
      count: result.rows.length,
      dueReviews: result.rows
    });
    
  } catch (error) {
    console.error("❌ Error fetching due reviews:", error);
    res.status(500).json({ 
      message: "Error fetching due reviews", 
      error: error.message 
    });
  }
});

// -----------------------
// GET: Fetch Scheduled Reviews
// -----------------------
app.get("/api/spaced-repetition/scheduled/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT sr.*, n.content 
       FROM spaced_repetition sr
       JOIN notes n ON sr.note_id = n.id
       WHERE sr.user_id = $1
       ORDER BY sr.next_review_date ASC`,
      [userId]
    );
    
    console.log(`📅 Found ${result.rows.length} scheduled reviews for user ${userId}`);
    
    res.json({
      count: result.rows.length,
      scheduledReviews: result.rows
    });
    
  } catch (error) {
    console.error("❌ Error fetching scheduled reviews:", error);
    res.status(500).json({ 
      message: "Error fetching scheduled reviews", 
      error: error.message 
    });
  }
});

// -----------------------
// DELETE: Remove Review Schedule
// -----------------------
app.delete("/api/spaced-repetition/:userId/:noteId", async (req, res) => {
  const { userId, noteId } = req.params;
  
  try {
    const result = await pool.query(
      "DELETE FROM spaced_repetition WHERE user_id = $1 AND note_id = $2 RETURNING *",
      [userId, noteId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Review schedule not found" });
    }
    
    console.log(`🗑️ Deleted review schedule for note ${noteId}`);
    
    res.json({
      message: "Review schedule deleted successfully",
      deletedReview: result.rows[0]
    });
    
  } catch (error) {
    console.error("❌ Error deleting review schedule:", error);
    res.status(500).json({ 
      message: "Error deleting review schedule", 
      error: error.message 
    });
  }
});

// -----------------------
// POST: Save Explanation History
// -----------------------
app.post("/api/explanation-history/save", async (req, res) => {
  console.log("💾 Saving explanation history:", req.body);
  
  const { userId, noteId, topic, userExplanation, aiFeedback, understandingScore } = req.body;
  
  if (!userId || !noteId || !userExplanation || !aiFeedback) {
    return res.status(400).json({ 
      message: "userId, noteId, userExplanation, and aiFeedback are required" 
    });
  }
  
  try {
    const result = await pool.query(
      `INSERT INTO explanation_history 
       (user_id, note_id, topic, user_explanation, ai_feedback, understanding_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, noteId, topic, userExplanation, JSON.stringify(aiFeedback), understandingScore]
    );
    
    console.log("✅ Explanation history saved successfully");
    
    res.json({
      message: "Explanation saved successfully",
      history: result.rows[0]
    });
    
  } catch (error) {
    console.error("❌ Error saving explanation history:", error);
    res.status(500).json({ 
      message: "Error saving explanation history", 
      error: error.message 
    });
  }
});

// -----------------------
// GET: Fetch Explanation History
// -----------------------
app.get("/api/explanation-history/:userId", async (req, res) => {
  const { userId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT eh.*, n.topic as note_topic
       FROM explanation_history eh
       JOIN notes n ON eh.note_id = n.id
       WHERE eh.user_id = $1
       ORDER BY eh.created_at DESC
       LIMIT 50`,
      [userId]
    );
    
    console.log(`📜 Found ${result.rows.length} explanation history records for user ${userId}`);
    
    res.json({
      count: result.rows.length,
      history: result.rows
    });
    
  } catch (error) {
    console.error("❌ Error fetching explanation history:", error);
    res.status(500).json({ 
      message: "Error fetching explanation history", 
      error: error.message 
    });
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