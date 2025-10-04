import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Auth from "./components/Auth";

function App() {
  return (
    <Router>
      <Routes>
        {/* All authentication (Signup/Login) handled inside Auth.jsx */}
        <Route path="/" element={<Auth />} />
        <Route path="/auth" element={<Auth />} />
      </Routes>
    </Router>
  );
}

export default App;
