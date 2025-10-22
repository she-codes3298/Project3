// utils/gemini.js
const axios = require("axios");
require("dotenv").config();

const MODEL = "gemini-2.5-flash";
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      const sub = text.slice(start, end + 1);
      try {
        return JSON.parse(sub);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

async function callGemini(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in environment");

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    ...(options.generationConfig ? { generationConfig: options.generationConfig } : {}),
  };

  const res = await axios.post(BASE_URL, payload, {
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    timeout: 120000, // 2 minutes
  });

  const data = res.data;
  try {
    const text =
      data?.candidates?.[0]?.content?.[0]?.parts?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return { raw: text, parsed: extractJSON(text) };
  } catch (err) {
    return { raw: JSON.stringify(data), parsed: null };
  }
}

module.exports = { callGemini };
