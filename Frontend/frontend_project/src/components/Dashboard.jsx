import React, { useState, useEffect } from "react";
import "../Dashboard.css";
import axios from "axios";

const Dashboard = () => {
  const [topic, setTopic] = useState("");
  const [files, setFiles] = useState([]); // Changed to array
  const [recentWorks, setRecentWorks] = useState([]);
  const [userId, setUserId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);

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

// inside Dashboard.jsx

const handleFileChange = (e) => {
  const selectedFiles = Array.from(e.target.files);

  if (selectedFiles.length + files.length > 5) {
    alert("You can upload up to 5 images only!");
    return;
  }

  setFiles((prevFiles) => [...prevFiles, ...selectedFiles]);
  console.log("📁 Files selected:", selectedFiles.length);
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

  try {
    const formData = new FormData();
    if (topic) formData.append("topic", topic);
    files.forEach((file) => formData.append("files", file));
    formData.append("userId", userId);

    const res = await axios.post("http://localhost:5000/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    console.log("✅ Server response:", res.data);

    // ✅ Create one entry for this upload batch
    const newWork = {
      topic: topic || "Uploaded Files",
      fileName: `${files.length} file(s)`,
      date: new Date().toLocaleString(),
      noteId: res.data.noteId, // single note ID now
    };

    // Add new upload entry to recent works
    setRecentWorks([newWork, ...recentWorks]);

    // Reset inputs
    setTopic("");
    setFiles([]);
    document.querySelector('input[type="file"]').value = "";

    alert(`${res.data.uploadedCount} file(s) uploaded and processed successfully!`);
  } catch (error) {
    console.error("❌ Upload error:", error);
    alert("Upload failed! Check console for details.");
  } finally {
    setUploading(false);
  }
};



  // 🧠 Handle AI Analysis (calls backend AI route)
  const handleAnalyze = async () => {
    if (recentWorks.length === 0) {
      alert("Please upload a note first!");
      return;
    }

    const lastNote = recentWorks[0];
    setAnalyzing(true);
    try {
      const res = await axios.post("http://localhost:5000/analyze", {
        noteId: lastNote.noteId,
        userId,
      });

      console.log("🧠 AI Analysis Result:", res.data);
      setAiResult(res.data);
    } catch (error) {
      console.error("❌ AI Analysis Error:", error);
      alert("Analysis failed! Check console.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <div className="sidebar">
        <h2 className="logo">ToteLearning</h2>
        <ul>
          <li>🏠 Home</li>
          <li>📚 Your Library</li>
          <li>🔔 Notifications</li>
          <li>👤 Profile</li>
        </ul>
      </div>

      {/* Main Content */}
      <div className="main">
        {/* Recent Work Section */}
        <div className="header">
          <h3>Recent Work</h3>
          <div className="recent-list">
            {recentWorks.length > 0 ? (
              recentWorks.map((work, index) => (
                <div key={index} className="recent-card">
                  <h4>{work.topic}</h4>
                  <p>{work.fileName}</p>
                  <span>{work.date}</span>
                </div>
              ))
            ) : (
              <p>No recent uploads yet.</p>
            )}
          </div>
        </div>

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
            
            {/* Display selected files */}
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
                        style={{ marginLeft: '10px', cursor: 'pointer' }}
                      >
                        ❌
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <button type="submit" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;