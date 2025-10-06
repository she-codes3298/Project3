import React, { useState, useEffect } from "react";
import "../Dashboard.css";
import axios from "axios";

const Dashboard = () => {
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState(null);
  const [recentWorks, setRecentWorks] = useState([]);
  const [userId, setUserId] = useState(null);
  const [uploading, setUploading] = useState(false);

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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    console.log("📁 File selected:", selectedFile);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    console.log("🚀 Starting upload...");
    console.log("📝 Topic:", topic);
    console.log("📄 File:", file);
    console.log("👤 UserId:", userId);

    // Changed validation: Either topic OR file is required
    if (!topic && !file) {
      alert("Please provide either a topic or upload a file!");
      return;
    }

    if (!userId) {
      alert("User not found. Please log in again.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      if (topic) formData.append("topic", topic);
      if (file) formData.append("file", file);
      formData.append("userId", userId);

      console.log("📤 Sending request to backend...");

      const res = await axios.post("http://localhost:5000/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      console.log("✅ Server response:", res.data);

      const newWork = {
        topic: topic || "Uploaded File",
        fileName: file ? file.name : "N/A",
        date: new Date().toLocaleString(),
      };

      setRecentWorks([newWork, ...recentWorks]);
      setTopic("");
      setFile(null);
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';

      alert("Notes uploaded successfully!");
      
    } catch (error) {
      console.error("❌ Upload error:", error);
      console.error("❌ Error response:", error.response);
      
      let errorMessage = "Upload failed: ";
      
      if (error.response) {
        // Server responded with error
        console.error("❌ Server error data:", error.response.data);
        console.error("❌ Server error status:", error.response.status);
        errorMessage += error.response.data?.message || error.response.data?.error || "Server error";
        
        if (error.response.data?.errorType) {
          errorMessage += ` (${error.response.data.errorType})`;
        }
      } else if (error.request) {
        // Request made but no response
        console.error("❌ No response from server");
        errorMessage += "No response from server. Is the backend running?";
      } else {
        // Something else happened
        console.error("❌ Error setting up request:", error.message);
        errorMessage += error.message;
      }
      
      alert(errorMessage);
    } finally {
      setUploading(false);
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
        {/* Header */}
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
              placeholder="Enter Topic Name (optional if uploading file)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <input 
              type="file" 
              onChange={handleFileChange}
              accept="image/*"
            />
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