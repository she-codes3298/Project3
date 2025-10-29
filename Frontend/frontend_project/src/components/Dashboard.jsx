import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "../Dashboard.css";
import axios from "axios";

const Dashboard = () => {
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState([]);
  const [recentWorks, setRecentWorks] = useState([]);
  const [userId, setUserId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const [dueReviewsCount, setDueReviewsCount] = useState(0);
  const [showLibrary, setShowLibrary] = useState(false); // Toggle for library dropdown

  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserId(user.id);
      console.log("✅ User loaded:", user);
    } else {
      alert("User not logged in. Redirecting to login...");
      window.location.href = "/auth";
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const storageKey = `recentWorks_user_${userId}`;

    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        setRecentWorks(JSON.parse(cached));
      } catch (_) { /* ignore parse errors */ }
    }

    const fetchNotes = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/notes/${userId}`);
        const notes = Array.isArray(res.data.notes) ? res.data.notes : [];
        const mapped = notes.map((note) => ({
          topic: note.topic || "Uploaded Files",
          fileName: (note.content && note.content.slice(0, 40) + (note.content.length > 40 ? "..." : "")) || "Saved Note",
          date: note.uploaded_at ? new Date(note.uploaded_at).toLocaleString() : new Date().toLocaleString(),
          noteId: note.id,
          content: note.content || "",
        }));
        setRecentWorks(mapped);
        localStorage.setItem(storageKey, JSON.stringify(mapped));
      } catch (err) {
        console.error("❌ Error fetching notes:", err);
      }
    };

    fetchNotes();

    // Restore currentNoteId and aiResult from sessionStorage on mount
    const savedNoteId = sessionStorage.getItem(`currentNoteId_${userId}`);
    const savedAiResult = sessionStorage.getItem(`aiResult_${userId}`);
    
    if (savedNoteId) {
      setCurrentNoteId(parseInt(savedNoteId));
      console.log("✅ Restored currentNoteId:", savedNoteId);
    }
    
    if (savedAiResult) {
      try {
        setAiResult(JSON.parse(savedAiResult));
        console.log("✅ Restored aiResult from session");
      } catch (err) {
        console.error("❌ Error parsing saved aiResult:", err);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const storageKey = `recentWorks_user_${userId}`;
    localStorage.setItem(storageKey, JSON.stringify(recentWorks));
  }, [recentWorks, userId]);

  // Save currentNoteId and aiResult to sessionStorage whenever they change
  useEffect(() => {
    if (!userId) return;
    
    if (currentNoteId) {
      sessionStorage.setItem(`currentNoteId_${userId}`, currentNoteId.toString());
    } else {
      sessionStorage.removeItem(`currentNoteId_${userId}`);
    }
  }, [currentNoteId, userId]);

  useEffect(() => {
    if (!userId) return;
    
    if (aiResult) {
      sessionStorage.setItem(`aiResult_${userId}`, JSON.stringify(aiResult));
    } else {
      sessionStorage.removeItem(`aiResult_${userId}`);
    }
  }, [aiResult, userId]);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (!userId) return;

    const fetchDueCount = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/spaced-repetition/due/${userId}`);
        setDueReviewsCount(res.data.count || 0);
      } catch (err) {
        console.error("❌ Error fetching due reviews:", err);
      }
    };

    fetchDueCount();
    const interval = setInterval(fetchDueCount, 60000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);

    if (selectedFiles.length + files.length > 5) {
      alert("You can upload up to 5 images only!");
      return;
    }

    setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
    console.log("🔎 Files selected:", selectedFiles.length);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!topic && files.length === 0) {
      alert("Please provide a topic or at least one file!");
      return;
    }

    if (files.length > 5) {
      alert("You can only upload a maximum of 5 files at once.");
      return;
    }

    setUploading(true);
    setAiResult(null);
    setCurrentNoteId(null);

    try {
      const formData = new FormData();
      if (topic) formData.append("topic", topic);
      files.forEach((file) => formData.append("files", file));
      formData.append("userId", userId);

      const res = await axios.post("http://localhost:5000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("✅ Server response:", res.data);

      const newWork = {
        topic: topic || "Uploaded Files",
        fileName: `${files.length} file(s)`,
        date: new Date().toLocaleString(),
        noteId: res.data.noteId,
        content: res.data.note?.content || "",
      };

      setCurrentNoteId(res.data.noteId);

      setRecentWorks((prev) => {
        const updated = [newWork, ...prev];
        if (userId) localStorage.setItem(`recentWorks_user_${userId}`, JSON.stringify(updated));
        return updated;
      });

      setTopic("");
      setFiles([]);
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = "";

      alert(`${res.data.uploadedCount} file(s) uploaded and processed successfully! Click "Analyze" to continue.`);
    } catch (error) {
      console.error("❌ Upload error:", error);
      alert("Upload failed! " + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!currentNoteId) {
      alert("Please upload a note first before analyzing!");
      return;
    }

    const lastNote = recentWorks.find(work => work.noteId === currentNoteId);
    
    if (!lastNote) {
      alert("Note not found. Please upload again.");
      return;
    }

    const contentToSend = lastNote.content || "";
    
    if (!contentToSend || contentToSend.trim().length === 0) {
      alert("No content available to analyze. Please ensure your upload contains text.");
      return;
    }

    setAnalyzing(true);
    try {
      const res = await axios.post("http://localhost:5000/api/ai/send-content", {
        contents: [contentToSend],
        prompt: "Please analyze and summarize the following notes in 2-3 sentences. Focus on the main topics and key concepts.",
      });

      console.log("🧠 AI Analysis Result:", res.data);
      setAiResult(res.data);
    } catch (error) {
      console.error("❌ AI Analysis Error:", error);
      alert("Analysis failed! " + (error.response?.data?.error || error.message));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = (mode) => {
    if (!currentNoteId) {
      alert("Please upload and analyze a note first!");
      return;
    }
    navigate(`/${mode}?noteId=${currentNoteId}`);
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="logo">ToteLearning</h2>
        <ul>
          <li>🏠 Home</li>
          <li 
            onClick={() => setShowLibrary(!showLibrary)}
            style={{ cursor: "pointer" }}
          >
            📚 Your Library {showLibrary ? "▼" : "▶"}
          </li>
          
          {/* Library Dropdown with Recent Works */}
          {showLibrary && (
            <div className="library-dropdown">
              <h4 style={{ 
                padding: "10px 20px", 
                margin: 0, 
                fontSize: "0.9rem",
                color: "#667eea",
                borderBottom: "1px solid #e0e0e0"
              }}>
                Recent Work
              </h4>
              {recentWorks.length > 0 ? (
                <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {recentWorks.map((work, index) => (
                    <div 
                      key={index} 
                      className="library-item"
                      style={{
                        padding: "12px 20px",
                        borderBottom: "1px solid #f0f0f0",
                        cursor: "pointer",
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#f5f5f5"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <div style={{ fontWeight: "600", fontSize: "0.9rem", marginBottom: "4px" }}>
                        {work.topic}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "2px" }}>
                        {work.fileName}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#999" }}>
                        {work.date}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "20px", textAlign: "center", color: "#999", fontSize: "0.85rem" }}>
                  No recent uploads yet.
                </div>
              )}
            </div>
          )}
          
          <li 
            onClick={() => navigate("/spaced-repetition")}
            style={{ cursor: "pointer", position: "relative" }}
          >
            🔁 Spaced Repetition
            {dueReviewsCount > 0 && (
              <span style={{
                position: "absolute",
                top: "5px",
                right: "10px",
                background: "#f44336",
                color: "white",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: "bold"
              }}>
                {dueReviewsCount}
              </span>
            )}
          </li>
          <li>👤 Profile</li>
        </ul>
      </div>

      {/* Main Content */}
      <div className="main">
        {/* Upload Section */}
        <div className="upload-section">
          <h2>Upload Your Notes</h2>
          <form onSubmit={handleUpload}>
            <input
              type="text"
              placeholder="Enter Topic Name (optional if uploading files)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <input
              type="file"
              onChange={handleFileChange}
              accept="image/*"
              multiple
            />

            {files.length > 0 && (
              <div className="selected-files">
                <h4>Selected Files ({files.length}):</h4>
                <ul>
                  {files.map((file, index) => (
                    <li key={index}>
                      {file.name}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        style={{ marginLeft: "10px", cursor: "pointer" }}
                      >
                        ❌
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="button-row">
              <button type="submit" disabled={uploading}>
                {uploading ? "⏳ Uploading..." : "📤 Upload"}
              </button>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={uploading || analyzing || !currentNoteId}
              >
                {analyzing ? "⏳ Analyzing..." : "🧠 Analyze"}
              </button>
            </div>
          </form>
        </div>

        {/* AI Analysis Result Section */}
        {aiResult && (
          <div className="ai-result">
            <h3>✨ AI Analysis Result</h3>
            <p>{aiResult.assistant || aiResult.message || aiResult.text || JSON.stringify(aiResult)}</p>

            <div className="ai-buttons-grid">
              <button 
                className="feature-button"
                onClick={() => handleGenerate("flashcards")}
              >
                <div className="button-icon">🧾</div>
                <div className="button-content">
                  <h4>Generate Flashcards</h4>
                  <p>Create interactive flashcards for quick review</p>
                </div>
              </button>

              <button 
                className="feature-button"
                onClick={() => handleGenerate("learn")}
              >
                <div className="button-icon">🧠</div>
                <div className="button-content">
                  <h4>Practice with MCQs</h4>
                  <p>Test your understanding with scenario-based questions</p>
                </div>
              </button>

              <button 
                className="feature-button"
                onClick={() => handleGenerate("mindmap")}
              >
                <div className="button-icon">🕸</div>
                <div className="button-content">
                  <h4>Create Mind Map</h4>
                  <p>Visualize connections between concepts</p>
                </div>
              </button>

              <button 
                className="feature-button"
                onClick={() => handleGenerate("explain")}
              >
                <div className="button-icon">📣</div>
                <div className="button-content">
                  <h4>Explain to Friend</h4>
                  <p>Test your understanding by explaining concepts</p>
                </div>
              </button>

              <button 
                className="feature-button spaced-repetition-btn"
                onClick={async () => {
                  if (!currentNoteId) {
                    alert("Please upload a note first!");
                    return;
                  }
                  
                  const difficulty = prompt(
                    "Rate the difficulty of this topic:\n\n" +
                    "1 - Very Easy 😊\n" +
                    "2 - Easy 🙂\n" +
                    "3 - Medium 😐\n" +
                    "4 - Hard 😟\n" +
                    "5 - Very Hard 😰\n\n" +
                    "Enter 1-5:"
                  );

                  if (!difficulty || difficulty < 1 || difficulty > 5) {
                    alert("Please enter a valid difficulty (1-5)");
                    return;
                  }

                  try {
                    const lastNote = recentWorks.find(work => work.noteId === currentNoteId) || recentWorks[0];
                    
                    const res = await axios.post("http://localhost:5000/api/spaced-repetition/review", {
                      userId,
                      noteId: currentNoteId,
                      topic: lastNote.topic,
                      difficultyLevel: parseInt(difficulty)
                    });

                    alert(
                      `✅ Added to spaced repetition!\n\n` +
                      `Next review in ${res.data.intervalDays} day(s)\n` +
                      `Review date: ${new Date(res.data.nextReview).toLocaleDateString()}`
                    );

                    const dueRes = await axios.get(`http://localhost:5000/api/spaced-repetition/due/${userId}`);
                    setDueReviewsCount(dueRes.data.count || 0);
                  } catch (error) {
                    console.error("❌ Error adding to spaced repetition:", error);
                    alert("Failed to schedule review: " + (error.response?.data?.message || error.message));
                  }
                }}
              >
                <div className="button-icon">🔁</div>
                <div className="button-content">
                  <h4>Add to Spaced Repetition</h4>
                  <p>Schedule reviews based on difficulty level</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;