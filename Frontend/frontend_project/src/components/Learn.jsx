import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./Learn.css";



const Learn = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const noteId = searchParams.get("noteId");
  
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [checkedAnswers, setCheckedAnswers] = useState({});
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!noteId) {
      setError("No note ID provided. Please go back and select a note.");
      setLoading(false);
      return;
    }

    const fetchMCQs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("📤 Requesting MCQs for noteId:", noteId);
        
        const res = await axios.post("http://localhost:5000/api/ai/learn", { noteId });
        
        console.log("📥 MCQs response:", res.data);
        
        // Handle response validation
        if (!res.data) {
          throw new Error("Empty response from server");
        }

        if (res.data.error) {
          throw new Error(res.data.error + (res.data.details ? `: ${res.data.details}` : ''));
        }
        
        if (res.data.questions && Array.isArray(res.data.questions)) {
          if (res.data.questions.length === 0) {
            throw new Error("No questions were generated. The content might be too short or unclear.");
          }
          setQuestions(res.data.questions);
          console.log(`✅ Loaded ${res.data.questions.length} questions`);
        } else {
          console.error("Invalid response structure:", res.data);
          throw new Error("Invalid questions format received from server");
        }
      } catch (error) {
        console.error("❌ Learn mode fetch failed:", error);
        
        // Detailed error message
        let errorMessage = "Failed to load questions";
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
          if (error.response.data.details) {
            errorMessage += `\n\nDetails: ${error.response.data.details}`;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchMCQs();
  }, [noteId]);

  const handleAnswer = (qIndex, option) => {
    // Don't allow changing answer after checking
    if (checkedAnswers[qIndex]) return;
    
    setAnswers((prev) => ({ ...prev, [qIndex]: option }));
  };

  const checkAnswer = (qIndex) => {
    const q = questions[qIndex];
    const userAnswer = answers[qIndex];
    
    if (!userAnswer) {
      alert("Please select an answer first!");
      return;
    }

    // Mark as checked
    setCheckedAnswers((prev) => ({ ...prev, [qIndex]: true }));

    // Extract letter from answer (handles "A", "A)", "A.", etc.)
    const correctLetter = q.correct.trim().charAt(0).toUpperCase();
    const userLetter = userAnswer.trim().charAt(0).toUpperCase();
    
    // Update score if correct
    if (userLetter === correctLetter) {
      setScore(prev => prev + 1);
    }
  };

  const getButtonClass = (qIndex, opt, isChecked) => {
    const userAnswer = answers[qIndex];
    const correctAnswer = questions[qIndex]?.correct;
    
    // Before checking: highlight selected option
    if (!isChecked) {
      return userAnswer === opt ? "option-btn selected" : "option-btn";
    }
    
    // After checking: show correct/incorrect
    const optLetter = opt.trim().charAt(0).toUpperCase();
    const correctLetter = correctAnswer?.trim().charAt(0).toUpperCase();
    const userLetter = userAnswer?.trim().charAt(0).toUpperCase();
    
    // Always highlight the correct answer in green
    if (optLetter === correctLetter) {
      return "option-btn correct";
    }
    
    // Highlight user's wrong answer in red
    if (optLetter === userLetter && userLetter !== correctLetter) {
      return "option-btn incorrect";
    }
    
    return "option-btn";
  };

  const allQuestionsChecked = questions.length > 0 && 
    Object.keys(checkedAnswers).length === questions.length &&
    Object.values(checkedAnswers).every(v => v === true);

  if (loading) {
    return (
      
      <div className="learn-container">
        <button 
  onClick={() => navigate("/dashboard")} 
  style={{
    backgroundColor: "#fff",
    color: "#764ba2",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.1)",
    marginBottom: "20px"
  }}
>
  ⬅ Back to Dashboard
</button>

        <div className="loading">
          <h2>🧠 Generating Questions...</h2>
          <p>Creating scenario-based learning questions for you...</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="learn-container">
        <div className="error">
          <h2>❌ Error</h2>
          <p style={{ whiteSpace: 'pre-wrap' }}>{error}</p>
          <button onClick={() => navigate("/dashboard")}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="learn-container">
      <div className="learn-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back to Dashboard
        </button>
        <h2 className="learn-title">🧠 Scenario-Based Learning</h2>
        <p className="learn-subtitle">
          Answer all questions to see your score! ({Object.keys(checkedAnswers).filter(k => checkedAnswers[k]).length}/{questions.length} completed)
        </p>
        {allQuestionsChecked && (
          <div className="score-card">
            <h3>🎉 Quiz Complete!</h3>
            <p className="score-text">Your Score: {score}/{questions.length}</p>
            <p className="score-percent">
              {Math.round((score / questions.length) * 100)}%
            </p>
          </div>
        )}
      </div>

      {questions.length > 0 ? (
        <div className="questions-container">
          {questions.map((q, i) => (
            <div key={i} className="question-card">
              <div className="question-number">Question {i + 1}</div>
              
              <div className="scenario">
                <span className="scenario-label">📖 Scenario:</span>
                <p>{q.scenario}</p>
              </div>
              
              <div className="question">
                <strong>Question:</strong> {q.question}
              </div>
              
              <div className="options-container">
                {q.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(i, opt)}
                    className={getButtonClass(i, opt, checkedAnswers[i])}
                    disabled={checkedAnswers[i]}
                  >
                    {opt}
                  </button>
                ))}
              </div>
              
              {answers[i] && !checkedAnswers[i] && (
                <button 
                  onClick={() => checkAnswer(i)} 
                  className="check-btn"
                >
                  ✓ Check Answer
                </button>
              )}
              
              {checkedAnswers[i] && q.explanation && (
                <div className="explanation">
                  <strong>💡 Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="error">
          <p>No questions were generated. Please try again with different content.</p>
          <button onClick={() => navigate("/dashboard")}>
            ← Back to Dashboard
          </button>
        </div>
      )}
    </div>
  );
};

export default Learn;