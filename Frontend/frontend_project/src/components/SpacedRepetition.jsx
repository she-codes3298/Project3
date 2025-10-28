import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./SpacedRepetition.css";

const SpacedRepetition = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(null);
  const [dueReviews, setDueReviews] = useState([]);
  const [scheduledReviews, setScheduledReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("due"); // "due" or "scheduled"
  const [reviewingNote, setReviewingNote] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setUserId(user.id);
    } else {
      alert("Please login first");
      navigate("/auth");
    }
  }, [navigate]);

  useEffect(() => {
    if (userId) {
      fetchReviews();
    }
  }, [userId]);

  const fetchReviews = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const [dueRes, scheduledRes] = await Promise.all([
        axios.get(`http://localhost:5000/api/spaced-repetition/due/${userId}`),
        axios.get(`http://localhost:5000/api/spaced-repetition/scheduled/${userId}`)
      ]);

      setDueReviews(dueRes.data.dueReviews || []);
      setScheduledReviews(scheduledRes.data.scheduledReviews || []);
      console.log("✅ Fetched reviews:", {
        due: dueRes.data.count,
        scheduled: scheduledRes.data.count
      });
    } catch (error) {
      console.error("❌ Error fetching reviews:", error);
      alert("Failed to load reviews: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const startReview = (review) => {
    setReviewingNote(review);
    setSelectedDifficulty(null);
  };

  const submitReview = async () => {
    if (!selectedDifficulty) {
      alert("Please select a difficulty level!");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post("http://localhost:5000/api/spaced-repetition/review", {
        userId,
        noteId: reviewingNote.note_id,
        topic: reviewingNote.topic,
        difficultyLevel: selectedDifficulty
      });

      console.log("✅ Review submitted:", res.data);
      alert(`Great! Review your next session in ${res.data.intervalDays} day(s) 📅`);
      
      // Refresh the lists
      await fetchReviews();
      setReviewingNote(null);
      setSelectedDifficulty(null);
    } catch (error) {
      console.error("❌ Error submitting review:", error);
      alert("Failed to submit review: " + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteReview = async (noteId) => {
    if (!window.confirm("Are you sure you want to remove this from your review schedule?")) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/api/spaced-repetition/${userId}/${noteId}`);
      console.log("✅ Review deleted");
      await fetchReviews();
    } catch (error) {
      console.error("❌ Error deleting review:", error);
      alert("Failed to delete: " + (error.response?.data?.message || error.message));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue!";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    return `In ${diffDays} days`;
  };

  const getDifficultyLabel = (level) => {
    const labels = {
      1: "😊 Very Easy",
      2: "🙂 Easy",
      3: "😐 Medium",
      4: "😓 Hard",
      5: "😰 Very Hard"
    };
    return labels[level] || "Unknown";
  };

  const getDifficultyColor = (level) => {
    const colors = {
      1: "#4caf50",
      2: "#8bc34a",
      3: "#ff9800",
      4: "#ff5722",
      5: "#f44336"
    };
    return colors[level] || "#999";
  };

  if (loading) {
    return (
      <div className="spaced-container">
        <div className="loading">
          <h2>📚 Loading Your Reviews...</h2>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (reviewingNote) {
    return (
      <div className="spaced-container">
        <div className="review-modal">
          <button 
            onClick={() => setReviewingNote(null)}
            className="close-modal-btn"
          >
            ✕
          </button>

          <h2>📖 Review Time!</h2>
          <div className="review-topic">
            <strong>Topic:</strong> {reviewingNote.topic}
          </div>

          <div className="review-content">
            <h3>Your Notes:</h3>
            <div className="content-preview">
              {reviewingNote.content?.substring(0, 500)}
              {reviewingNote.content?.length > 500 && "..."}
            </div>
          </div>

          <div className="difficulty-selection">
            <h3>How difficult was this review?</h3>
            <p className="difficulty-hint">This helps us schedule your next review optimally</p>
            
            <div className="difficulty-options">
              {[1, 2, 3, 4, 5].map(level => (
                <button
                  key={level}
                  onClick={() => setSelectedDifficulty(level)}
                  className={`difficulty-btn ${selectedDifficulty === level ? 'selected' : ''}`}
                  style={{
                    borderColor: selectedDifficulty === level ? getDifficultyColor(level) : '#ddd',
                    backgroundColor: selectedDifficulty === level ? getDifficultyColor(level) + '20' : 'white'
                  }}
                >
                  <div className="difficulty-emoji">
                    {getDifficultyLabel(level).split(' ')[0]}
                  </div>
                  <div className="difficulty-text">
                    {getDifficultyLabel(level).split(' ').slice(1).join(' ')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="review-actions">
            <button 
              onClick={submitReview}
              disabled={!selectedDifficulty || submitting}
              className="submit-review-btn"
            >
              {submitting ? "Submitting..." : "Submit Review ✓"}
            </button>
            <button 
              onClick={() => setReviewingNote(null)}
              className="cancel-review-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="spaced-container">
      <div className="spaced-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back to Dashboard
        </button>
        <h2 className="spaced-title">🔁 Spaced Repetition</h2>
        <p className="spaced-subtitle">
          Review at optimal intervals to maximize long-term retention
        </p>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === "due" ? "active" : ""}`}
          onClick={() => setActiveTab("due")}
        >
          📌 Due Now ({dueReviews.length})
        </button>
        <button 
          className={`tab ${activeTab === "scheduled" ? "active" : ""}`}
          onClick={() => setActiveTab("scheduled")}
        >
          📅 Scheduled ({scheduledReviews.length})
        </button>
      </div>

      {activeTab === "due" ? (
        <div className="reviews-container">
          {dueReviews.length > 0 ? (
            <>
              <div className="info-banner">
                <span>🎯</span>
                <p>You have {dueReviews.length} topic(s) ready for review. Let's reinforce your learning!</p>
              </div>
              
              <div className="reviews-grid">
                {dueReviews.map((review) => (
                  <div key={review.id} className="review-card due">
                    <div className="review-card-header">
                      <h3>{review.topic}</h3>
                      <span className="due-badge">Due Now!</span>
                    </div>

                    <div className="review-stats">
                      <div className="stat">
                        <span className="stat-label">Reviews:</span>
                        <span className="stat-value">{review.repetition_count}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Last:</span>
                        <span className="stat-value">
                          {new Date(review.last_reviewed).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Difficulty:</span>
                        <span 
                          className="stat-value"
                          style={{ color: getDifficultyColor(review.difficulty_level) }}
                        >
                          {getDifficultyLabel(review.difficulty_level).split(' ')[1]}
                        </span>
                      </div>
                    </div>

                    <div className="review-actions-card">
                      <button 
                        onClick={() => startReview(review)}
                        className="review-btn"
                      >
                        Start Review 📖
                      </button>
                      <button 
                        onClick={() => deleteReview(review.note_id)}
                        className="delete-btn-small"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h3>All Caught Up!</h3>
              <p>No reviews due right now. Check back later or add new topics to your schedule.</p>
              <button 
                onClick={() => navigate("/dashboard")}
                className="add-topics-btn"
              >
                Add New Topics
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="reviews-container">
          {scheduledReviews.length > 0 ? (
            <div className="reviews-grid">
              {scheduledReviews.map((review) => {
                const isDue = new Date(review.next_review_date) <= new Date();
                return (
                  <div key={review.id} className={`review-card ${isDue ? 'due' : 'scheduled'}`}>
                    <div className="review-card-header">
                      <h3>{review.topic}</h3>
                      <span className={`schedule-badge ${isDue ? 'due' : ''}`}>
                        {formatDate(review.next_review_date)}
                      </span>
                    </div>

                    <div className="review-stats">
                      <div className="stat">
                        <span className="stat-label">Reviews:</span>
                        <span className="stat-value">{review.repetition_count}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Interval:</span>
                        <span className="stat-value">{review.interval_days} days</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Next Review:</span>
                        <span className="stat-value">
                          {new Date(review.next_review_date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <div className="review-actions-card">
                      {isDue && (
                        <button 
                          onClick={() => startReview(review)}
                          className="review-btn"
                        >
                          Review Now 📖
                        </button>
                      )}
                      <button 
                        onClick={() => deleteReview(review.note_id)}
                        className="delete-btn-small"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>No Scheduled Reviews</h3>
              <p>Start adding topics to your spaced repetition schedule from your dashboard.</p>
              <button 
                onClick={() => navigate("/dashboard")}
                className="add-topics-btn"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SpacedRepetition;