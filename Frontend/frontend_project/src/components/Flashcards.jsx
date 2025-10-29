import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";
import "./Flashcards.css";

const Flashcards = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const noteId = searchParams.get("noteId");
  
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});

  useEffect(() => {
    if (!noteId) {
      setError("No note ID provided. Please go back and select a note.");
      setLoading(false);
      return;
    }

    const fetchFlashcards = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("📤 Requesting flashcards for noteId:", noteId);
        
        const res = await axios.post("http://localhost:5000/api/ai/flashcards", { noteId });
        
        console.log("📥 Flashcards response:", res.data);
        
        if (res.data.flashcards && Array.isArray(res.data.flashcards)) {
          setFlashcards(res.data.flashcards);
        } else {
          throw new Error("Invalid flashcards format received from server");
        }
      } catch (error) {
        console.error("❌ Flashcard generation failed:", error);
        setError(error.response?.data?.error || error.message || "Failed to generate flashcards");
      } finally {
        setLoading(false);
      }
    };

    fetchFlashcards();
  }, [noteId]);

  const toggleFlip = (index) => {
    setFlippedCards(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  if (loading) {
    return (
      <div className="flashcards-container">
        <div className="loading">
          <h2>🧾 Generating Flashcards...</h2>
          <p>This may take a few moments. Please wait.</p>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flashcards-container">
        <div className="error">
          <h2>❌ Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flashcards-container">
      <div className="flashcards-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back to Dashboard
        </button>
        <h2>🧾 Flashcards ({flashcards.length})</h2>
        <p className="hint">Click on any card to flip it!</p>
      </div>

      {flashcards.length > 0 ? (
        <div className="flashcards-grid">
          {flashcards.map((card, i) => (
            <div 
              className={`flashcard ${flippedCards[i] ? 'flipped' : ''}`}
              key={i}
              onClick={() => toggleFlip(i)}
            >
              <div className="flashcard-inner">
                <div className="flashcard-front">
                  <div className="card-label">Question</div>
                  <div className="card-content">{card.question}</div>
                  <div className="flip-hint">Click to reveal answer</div>
                </div>
                <div className="flashcard-back">
                  <div className="card-label">Answer</div>
                  <div className="card-content">{card.answer}</div>
                  <div className="flip-hint">Click to see question</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-flashcards">
          <p>No flashcards were generated. Please try again.</p>
          <button onClick={() => navigate("/dashboard")}>← Back to Dashboard</button>
        </div>
      )}
    </div>
  );
};

export default Flashcards;