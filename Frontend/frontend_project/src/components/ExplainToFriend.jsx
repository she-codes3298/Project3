import React, { useState, useEffect } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./ExplainToFriend.css";

const ExplainToFriend = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const noteId = searchParams.get("noteId");
  
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [topic, setTopic] = useState("");
  const [showTips, setShowTips] = useState(true);
  const [charCount, setCharCount] = useState(0);
  const [error, setError] = useState(null);
  const minChars = 50;

  useEffect(() => {
    console.log("📍 ExplainToFriend mounted");
    console.log("📍 Note ID from URL:", noteId);
    
    if (!noteId) {
      console.error("❌ No noteId found in URL");
      alert("No note ID provided. Redirecting to dashboard...");
      navigate("/dashboard");
    }
  }, [noteId, navigate]);

  const handleExplanationChange = (e) => {
    const text = e.target.value;
    setExplanation(text);
    setCharCount(text.length);
  };

  const handleSubmit = async () => {
    if (explanation.trim().length < minChars) {
      alert(`Please write at least ${minChars} characters. Your explanation helps us understand how well you've learned!`);
      return;
    }

    setLoading(true);
    setFeedback(null);
    setError(null);

    try {
      const userId = JSON.parse(localStorage.getItem("user"))?.id;
      console.log("👤 User ID:", userId);
      console.log("📤 Sending explanation for note:", noteId);
      console.log("✍️ Explanation length:", explanation.length);

      // Get AI feedback
      const res = await axios.post("http://localhost:5000/api/ai/explain-feedback", {
        noteId: parseInt(noteId),
        userExplanation: explanation.trim()
      });

      console.log("🎯 Full response:", res.data);
      
      if (!res.data.feedback) {
        // Check if there's a fallback feedback
        if (res.data.fallbackFeedback) {
          console.warn("⚠️ Using fallback feedback");
          setFeedback(res.data.fallbackFeedback);
          setTopic("Your Topic");
        } else {
          throw new Error("No feedback received from server");
        }
      } else {
        setFeedback(res.data.feedback);
        setTopic(res.data.topic || "Your Topic");
      }

      // Save to history
      if (userId && res.data.feedback) {
        try {
          await axios.post("http://localhost:5000/api/explanation-history/save", {
            userId,
            noteId: parseInt(noteId),
            topic: res.data.topic || "Unknown Topic",
            userExplanation: explanation,
            aiFeedback: res.data.feedback,
            understandingScore: res.data.feedback.overallScore
          });
          console.log("✅ Explanation saved to history");
        } catch (historyErr) {
          console.error("⚠️ Failed to save history (non-critical):", historyErr);
          // Don't fail the whole operation if history save fails
        }
      }

    } catch (error) {
      console.error("❌ Error getting feedback:", error);
      console.error("❌ Error response:", error.response?.data);
      
      let errorMessage = "Unknown error occurred";
      
      if (error.response?.data) {
        errorMessage = error.response.data.error || error.response.data.message || errorMessage;
        
        // If there's a fallback feedback in the error response, use it
        if (error.response.data.fallbackFeedback) {
          console.log("✅ Using fallback feedback from error response");
          setFeedback(error.response.data.fallbackFeedback);
          setTopic("Your Topic");
          setLoading(false);
          return;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      alert("Failed to get feedback: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#4caf50"; // green
    if (score >= 60) return "#ff9800"; // orange
    return "#f44336"; // red
  };

  const getScoreLabel = (score) => {
    if (score >= 90) return "Excellent! 🌟";
    if (score >= 80) return "Great! 👍";
    if (score >= 70) return "Good! 👏";
    if (score >= 60) return "Fair 📚";
    return "Needs Work 💪";
  };

  // Show loading state
  if (loading) {
    return (
      <div className="explain-container">
        <div className="loading">
          <h2>🤔 Analyzing Your Explanation...</h2>
          <p>Our AI tutor is reviewing your understanding...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !feedback) {
    return (
      <div className="explain-container">
        <div className="error-state">
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button onClick={() => {
            setError(null);
            setExplanation("");
            setFeedback(null);
          }}>
            Try Again
          </button>
          <button onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="explain-container">
      <div className="explain-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back to Dashboard
        </button>
        <h2 className="explain-title">📣 Explain to a Friend</h2>
        <p className="explain-subtitle">
          Teaching is the best way to learn! Explain this topic in your own words.
        </p>
      </div>

      {!feedback ? (
        <>
          {showTips && (
            <div className="tips-card">
              <div className="tips-header">
                <h3>💡 Tips for a Great Explanation</h3>
                <button 
                  onClick={() => setShowTips(false)}
                  className="close-tips"
                >
                  ✕
                </button>
              </div>
              <ul>
                <li>🗣️ Imagine you're explaining to someone who knows nothing about this topic</li>
                <li>🌟 Use simple words and avoid jargon</li>
                <li>📖 Include examples or analogies to make it clear</li>
                <li>🎯 Focus on the main concepts and why they matter</li>
                <li>❤️ Write naturally - don't just copy from your notes!</li>
              </ul>
            </div>
          )}

          <div className="explanation-box">
            <label>Your Explanation:</label>
            <textarea
              value={explanation}
              onChange={handleExplanationChange}
              placeholder="Start explaining... For example: 'This topic is about... The main idea is... A good way to think about it is...'"
              rows={12}
            />
            <div className="char-counter">
              <span className={charCount >= minChars ? "valid" : "invalid"}>
                {charCount} / {minChars} characters minimum
              </span>
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            className="submit-btn"
            disabled={charCount < minChars}
          >
            Get Feedback 🎯
          </button>
        </>
      ) : (
        <div className="feedback-container">
          <div className="score-overview">
            <div className="main-score" style={{ borderColor: getScoreColor(feedback.overallScore) }}>
              <div className="score-value" style={{ color: getScoreColor(feedback.overallScore) }}>
                {feedback.overallScore}%
              </div>
              <div className="score-label">{getScoreLabel(feedback.overallScore)}</div>
            </div>

            <div className="sub-scores">
              <div className="sub-score">
                <span className="sub-score-label">Clarity</span>
                <div className="score-bar">
                  <div 
                    className="score-fill" 
                    style={{ 
                      width: `${feedback.clarityScore}%`,
                      backgroundColor: getScoreColor(feedback.clarityScore)
                    }}
                  />
                </div>
                <span className="sub-score-value">{feedback.clarityScore}%</span>
              </div>

              <div className="sub-score">
                <span className="sub-score-label">Accuracy</span>
                <div className="score-bar">
                  <div 
                    className="score-fill" 
                    style={{ 
                      width: `${feedback.accuracyScore}%`,
                      backgroundColor: getScoreColor(feedback.accuracyScore)
                    }}
                  />
                </div>
                <span className="sub-score-value">{feedback.accuracyScore}%</span>
              </div>

              <div className="sub-score">
                <span className="sub-score-label">Completeness</span>
                <div className="score-bar">
                  <div 
                    className="score-fill" 
                    style={{ 
                      width: `${feedback.completenessScore}%`,
                      backgroundColor: getScoreColor(feedback.completenessScore)
                    }}
                  />
                </div>
                <span className="sub-score-value">{feedback.completenessScore}%</span>
              </div>
            </div>
          </div>

          <div className="encouragement-card">
            <h3>💬 Personal Message</h3>
            <p>{feedback.encouragement}</p>
          </div>

          <div className="feedback-grid">
            <div className="feedback-section strengths">
              <h3>✅ What You Did Well</h3>
              <ul>
                {feedback.strengths && feedback.strengths.length > 0 ? (
                  feedback.strengths.map((strength, idx) => (
                    <li key={idx}>{strength}</li>
                  ))
                ) : (
                  <li>Keep working on your explanation!</li>
                )}
              </ul>
            </div>

            <div className="feedback-section improvements">
              <h3>🎯 Areas to Improve</h3>
              <ul>
                {feedback.areasToImprove && feedback.areasToImprove.length > 0 ? (
                  feedback.areasToImprove.map((area, idx) => (
                    <li key={idx}>{area}</li>
                  ))
                ) : (
                  <li>You're doing great! Keep learning.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="concepts-grid">
            <div className="concepts-section covered">
              <h3>✓ Concepts You Covered</h3>
              <div className="concept-tags">
                {feedback.keyConceptsCovered && feedback.keyConceptsCovered.length > 0 ? (
                  feedback.keyConceptsCovered.map((concept, idx) => (
                    <span key={idx} className="concept-tag covered-tag">
                      {concept}
                    </span>
                  ))
                ) : (
                  <span className="concept-tag covered-tag">Review your explanation</span>
                )}
              </div>
            </div>

            <div className="concepts-section missed">
              <h3>○ Concepts to Review</h3>
              <div className="concept-tags">
                {feedback.keyConceptsMissed && feedback.keyConceptsMissed.length > 0 ? (
                  feedback.keyConceptsMissed.map((concept, idx) => (
                    <span key={idx} className="concept-tag missed-tag">
                      {concept}
                    </span>
                  ))
                ) : (
                  <span className="concept-tag covered-tag">All concepts covered! 🎉</span>
                )}
              </div>
            </div>
          </div>

          {feedback.analogyQuality && feedback.analogyQuality !== "None used" && (
            <div className="analogy-feedback">
              <h3>🎨 Your Analogies & Examples</h3>
              <p>{feedback.analogyQuality}</p>
            </div>
          )}

          {feedback.nextSteps && feedback.nextSteps.length > 0 && (
            <div className="next-steps">
              <h3>🔥 Next Steps</h3>
              <ol>
                {feedback.nextSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="action-buttons">
            <button 
              onClick={() => {
                setExplanation("");
                setFeedback(null);
                setCharCount(0);
                setShowTips(true);
              }}
              className="try-again-btn"
            >
              🔄 Try Explaining Again
            </button>
            <button 
              onClick={() => navigate("/dashboard")}
              className="done-btn"
            >
              ✓ Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExplainToFriend;