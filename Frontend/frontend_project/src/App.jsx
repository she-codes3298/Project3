import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Auth from "./components/Auth";
import Dashboard from "./components/Dashboard";
import Flashcards from "./components/Flashcards";
import Learn from "./components/Learn";
import MindMap from './components/MindMap';
import ExplainToFriend from './components/ExplainToFriend';  // ✅ ADD THIS
import SpacedRepetition from './components/SpacedRepetition';  // ✅ ADD THIS

function App() {
  return (
    <Router>
      <Routes>
        {/* All authentication (Signup/Login) handled inside Auth.jsx */}
        <Route path="/" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/mindmap" element={<MindMap />} />
        <Route path="/explain" element={<ExplainToFriend />} />
        <Route path="/spaced-repetition" element={<SpacedRepetition />} />
      </Routes>
    </Router>
  );
}

export default App;