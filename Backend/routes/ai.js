const express = require('express');
const router = express.Router();
const pool = require("../database");

// POST /api/ai/send-content
router.post('/send-content', async (req, res) => {
  const { contents, prompt, model = 'gpt-4o-mini' } = req.body || {};
  
  if (!contents || !Array.isArray(contents) || contents.length === 0) {
    return res.status(400).json({ error: 'No contents provided. Send { contents: ["..."] }' });
  }

  const combinedText = contents.join('\n\n');

  const defaultPrompt = `Please analyze the following content and provide a brief summary (2-3 sentences) highlighting the main topics and key concepts:\n\n${combinedText}`;
  const userMessage = prompt && typeof prompt === 'string' ? prompt + '\n\n' + combinedText : defaultPrompt;

  const messages = [
    { role: 'system', content: 'You are a helpful learning assistant that analyzes educational content and helps students understand key concepts.' },
    { role: 'user', content: userMessage }
  ];

  try {
    const fetchFn = global.fetch ?? (async (...args) => {
      const mod = await import('node-fetch');
      return mod.default(...args);
    });

    const resp = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.3,
        max_tokens: 500
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('❌ OpenAI API error:', errText);
      return res.status(resp.status).json({ error: 'OpenAI API error', details: errText });
    }

    const data = await resp.json();
    const assistant = data.choices?.[0]?.message?.content ?? null;
    
    if (!assistant) {
      console.error('❌ No assistant content in response:', data);
      return res.status(500).json({ error: 'No response from AI', raw: data });
    }
    
    return res.json({ assistant, raw: data });
  } catch (err) {
    console.error('❌ AI route error:', err);
    return res.status(500).json({ error: 'Failed to call OpenAI', details: err.message });
  }
});

// POST /api/ai/flashcards
router.post('/flashcards', async (req, res) => {
  const { noteId } = req.body;
  
  if (!noteId) {
    return res.status(400).json({ error: "noteId is required" });
  }

  try {
    const dbRes = await pool.query("SELECT content FROM notes WHERE id=$1", [noteId]);
    
    if (dbRes.rows.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    const content = dbRes.rows[0].content;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Note has no content to generate flashcards from" });
    }

    const prompt = `You are a creative learning assistant helping students understand concepts through analogies and simple explanations.

From the content below, generate exactly 8 flashcards in JSON format.

RULES:
1. Use analogies, metaphors, and real-world examples that students can relate to
2. Avoid technical jargon - use simple, everyday language
3. Make concepts memorable through stories or comparisons
4. Each flashcard should help understanding, not just memorization
5. Questions should be clear and specific
6. Answers should be concise but complete (2-3 sentences max)

Format (MUST be valid JSON array):
[
  {
    "question": "Clear question using simple language or analogy",
    "answer": "Concise answer with explanation or analogy"
  }
]

---CONTENT---
${content}
---

IMPORTANT: Return ONLY the JSON array, no markdown code blocks, no extra text, just the raw JSON array starting with [ and ending with ].`;

    const fetchFn = global.fetch ?? (async (...args) => {
      const mod = await import('node-fetch');
      return mod.default(...args);
    });

    const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant that generates educational flashcards in JSON format." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ OpenAI API error:", errText);
      return res.status(response.status).json({ error: "OpenAI API error", details: errText });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content;
    
    if (!text) {
      console.error("❌ No content in OpenAI response:", data);
      return res.status(500).json({ error: "No response from AI" });
    }

    console.log("📄 Raw AI response:", text);
    
    let flashcards = [];
    try {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        flashcards = JSON.parse(jsonMatch[0]);
      } else {
        flashcards = JSON.parse(text);
      }
      
      if (!Array.isArray(flashcards)) {
        throw new Error("Response is not an array");
      }
      
      flashcards = flashcards.filter(card => card.question && card.answer);
      
      if (flashcards.length === 0) {
        throw new Error("No valid flashcards generated");
      }
      
      console.log(`✅ Generated ${flashcards.length} flashcards`);
      
    } catch (parseErr) {
      console.error("❌ JSON parse error:", parseErr);
      console.error("❌ Problematic text:", text);
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        details: parseErr.message,
        rawResponse: text 
      });
    }
    
    res.json({ flashcards });
    
  } catch (err) {
    console.error("❌ Flashcard generation error:", err.message);
    res.status(500).json({ error: "Flashcard generation failed", details: err.message });
  }
});

// POST /api/ai/learn
router.post('/learn', async (req, res) => {
  const { noteId } = req.body;
  
  if (!noteId) {
    return res.status(400).json({ error: "noteId is required" });
  }

  try {
    console.log("🔍 Fetching note with ID:", noteId);
    const dbRes = await pool.query("SELECT content FROM notes WHERE id=$1", [noteId]);
    
    if (dbRes.rows.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    const content = dbRes.rows[0].content;
    console.log("📄 Content length:", content?.length || 0);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Note has no content to generate questions from" });
    }

    if (content.trim().length < 100) {
      return res.status(400).json({ 
        error: "Content is too short to generate meaningful questions. Please provide at least a few sentences of content." 
      });
    }

    const prompt = `You are a creative educator helping students learn through real-world scenarios and application-based questions.

From the content below, create exactly 5 scenario-based multiple choice questions that test UNDERSTANDING, not memorization.

RULES:
1. Create realistic scenarios students can imagine themselves in
2. Questions should require applying the concept, not recalling facts
3. Use simple language and relatable situations
4. Each question must have exactly 4 options (A, B, C, D)
5. Wrong answers should be plausible but clearly incorrect when you understand the concept
6. Include brief explanations (1-2 sentences) for why the correct answer works
7. Correct answer should be indicated with just the letter (A, B, C, or D)

Format (MUST be valid JSON array):
[
  {
    "scenario": "Imagine you're in [realistic situation a student can picture]...",
    "question": "What would happen if...? / Why does...? / How would you...?",
    "options": [
      "A) First option",
      "B) Second option",
      "C) Third option",
      "D) Fourth option"
    ],
    "correct": "B",
    "explanation": "Brief reason why B is correct using the concept"
  }
]

---CONTENT---
${content}
---

IMPORTANT: Return ONLY the JSON array, no markdown code blocks, no extra text, just the raw JSON array starting with [ and ending with ].`;

    const fetchFn = global.fetch ?? (async (...args) => {
      const mod = await import('node-fetch');
      return mod.default(...args);
    });

    console.log("🤖 Calling OpenAI API...");
    const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant that generates educational scenario-based questions in JSON format. Always return valid JSON arrays only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ OpenAI API error:", response.status, errText);
      return res.status(response.status).json({ error: "OpenAI API error", details: errText });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content;
    
    if (!text) {
      console.error("❌ No content in OpenAI response:", data);
      return res.status(500).json({ error: "No response from AI", details: "OpenAI returned empty content" });
    }

    console.log("📄 Raw AI response (first 500 chars):", text.substring(0, 500));
    
    let questions = [];
    try {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        console.log("✅ Found JSON array in response");
        questions = JSON.parse(jsonMatch[0]);
      } else {
        console.log("⚠️ No JSON array pattern found, trying direct parse");
        questions = JSON.parse(text);
      }
      
      if (!Array.isArray(questions)) {
        throw new Error("Response is not an array");
      }
      
      console.log(`📊 Parsed ${questions.length} questions, validating...`);
      
      questions = questions.filter(q => {
        const isValid = q.scenario && q.question && q.options && 
          Array.isArray(q.options) && q.options.length === 4 && 
          q.correct && q.explanation;
        
        if (!isValid) {
          console.warn("⚠️ Invalid question filtered out:", q);
        }
        return isValid;
      });
      
      if (questions.length === 0) {
        throw new Error("No valid questions generated after filtering");
      }
      
      console.log(`✅ Generated ${questions.length} valid questions`);
      
    } catch (parseErr) {
      console.error("❌ JSON parse error:", parseErr.message);
      console.error("❌ Problematic text (first 1000 chars):", text.substring(0, 1000));
      return res.status(500).json({ 
        error: "Failed to parse AI response as JSON", 
        details: `Parse error: ${parseErr.message}. The AI may have returned invalid JSON format.`,
        rawResponse: text.substring(0, 500) + "..." 
      });
    }
    
    res.json({ questions });
    
  } catch (err) {
    console.error("❌ Learn mode error:", err.message);
    console.error("❌ Stack trace:", err.stack);
    res.status(500).json({ 
      error: "Question generation failed", 
      details: err.message 
    });
  }
});

// POST /api/ai/mindmap
router.post('/mindmap', async (req, res) => {
  const { noteId } = req.body;
  
  if (!noteId) {
    return res.status(400).json({ error: "noteId is required" });
  }

  try {
    console.log("🔍 Fetching note for mind map with ID:", noteId);
    const dbRes = await pool.query("SELECT content FROM notes WHERE id=$1", [noteId]);
    
    if (dbRes.rows.length === 0) {
      return res.status(404).json({ error: "Note not found" });
    }
    
    const content = dbRes.rows[0].content;
    console.log("📄 Content length:", content?.length || 0);

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: "Note has no content to generate mind map from" });
    }

    if (content.trim().length < 100) {
      return res.status(400).json({ 
        error: "Content is too short to generate a meaningful mind map. Please provide more detailed content." 
      });
    }

    const prompt = `You are an expert educational designer helping students visualize knowledge through mind maps.

From the content below, create a hierarchical mind map structure that shows:
1. The MAIN TOPIC at the root (one clear central concept)
2. 3-5 KEY CONCEPTS as direct children (major subtopics)
3. 2-4 SUPPORTING DETAILS for each key concept (specific facts, examples, or explanations)

RULES:
1. Use clear, concise labels (2-5 words max per node)
2. Organize information hierarchically from general to specific
3. Focus on relationships and connections between concepts
4. Keep descriptions brief but informative
5. Ensure the structure makes learning relationships visible

Format (MUST be valid JSON):
{
  "name": "Main Topic Title",
  "description": "Brief overview of the main concept",
  "children": [
    {
      "name": "Key Concept 1",
      "description": "What this concept covers",
      "children": [
        {
          "name": "Supporting Detail 1A",
          "description": "Specific information or example"
        },
        {
          "name": "Supporting Detail 1B",
          "description": "Specific information or example"
        }
      ]
    },
    {
      "name": "Key Concept 2",
      "description": "What this concept covers",
      "children": [
        {
          "name": "Supporting Detail 2A",
          "description": "Specific information or example"
        }
      ]
    }
  ]
}

---CONTENT---
${content}
---

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no extra text, just the raw JSON object starting with { and ending with }.`;

    const fetchFn = global.fetch ?? (async (...args) => {
      const mod = await import('node-fetch');
      return mod.default(...args);
    });

    console.log("🤖 Calling OpenAI API for mind map generation...");
    const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a helpful assistant that generates hierarchical mind map structures in JSON format. Always return valid JSON objects only." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ OpenAI API error:", response.status, errText);
      return res.status(response.status).json({ error: "OpenAI API error", details: errText });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content;
    
    if (!text) {
      console.error("❌ No content in OpenAI response:", data);
      return res.status(500).json({ error: "No response from AI", details: "OpenAI returned empty content" });
    }

    console.log("📄 Raw AI response (first 500 chars):", text.substring(0, 500));
    
    let mindmap = null;
    try {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log("✅ Found JSON object in response");
        mindmap = JSON.parse(jsonMatch[0]);
      } else {
        console.log("⚠️ No JSON object pattern found, trying direct parse");
        mindmap = JSON.parse(text);
      }
      
      if (!mindmap.name) {
        throw new Error("Mind map must have a 'name' property for the root node");
      }
      
      if (!mindmap.children || !Array.isArray(mindmap.children)) {
        throw new Error("Mind map must have a 'children' array");
      }
      
      const validateNode = (node, depth = 0) => {
        if (!node.name || typeof node.name !== 'string') {
          return false;
        }
        if (node.children) {
          if (!Array.isArray(node.children)) return false;
          return node.children.every(child => validateNode(child, depth + 1));
        }
        return true;
      };
      
      if (!validateNode(mindmap)) {
        throw new Error("Invalid node structure in mind map");
      }
      
      console.log(`✅ Generated valid mind map with ${mindmap.children.length} main branches`);
      
    } catch (parseErr) {
      console.error("❌ JSON parse error:", parseErr.message);
      console.error("❌ Problematic text (first 1000 chars):", text.substring(0, 1000));
      return res.status(500).json({ 
        error: "Failed to parse AI response as JSON", 
        details: `Parse error: ${parseErr.message}. The AI may have returned invalid JSON format.`,
        rawResponse: text.substring(0, 500) + "..." 
      });
    }
    
    res.json({ mindmap });
    
  } catch (err) {
    console.error("❌ Mind map generation error:", err.message);
    console.error("❌ Stack trace:", err.stack);
    res.status(500).json({ 
      error: "Mind map generation failed", 
      details: err.message 
    });
  }
});

// ============================================
// EXPLAIN TO FRIEND FEATURE - FIXED
// ============================================

router.post('/explain-feedback', async (req, res) => {
  console.log("📝 Received explain-feedback request");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  
  const { noteId, userExplanation } = req.body;
  
  // Validation
  if (!noteId) {
    console.error("❌ Missing noteId");
    return res.status(400).json({ error: "noteId is required" });
  }
  
  if (!userExplanation) {
    console.error("❌ Missing userExplanation");
    return res.status(400).json({ error: "userExplanation is required" });
  }

  if (userExplanation.trim().length < 50) {
    console.error("❌ Explanation too short");
    return res.status(400).json({ error: "Explanation must be at least 50 characters" });
  }

  try {
    console.log("🔍 Fetching note for explanation feedback with ID:", noteId);
    const dbRes = await pool.query("SELECT content, topic FROM notes WHERE id=$1", [noteId]);
    
    if (dbRes.rows.length === 0) {
      console.error("❌ Note not found in database");
      return res.status(404).json({ error: "Note not found" });
    }
    
    const { content: originalContent, topic } = dbRes.rows[0];
    console.log("📄 Original content length:", originalContent?.length || 0);
    console.log("📝 Topic:", topic);
    console.log("✍️ User explanation length:", userExplanation?.length || 0);

    if (!originalContent || originalContent.trim().length === 0) {
      console.error("❌ Note has no content");
      return res.status(400).json({ error: "Note has no content to compare against" });
    }

    const prompt = `You are a supportive AI tutor evaluating a student's understanding of a topic.

**ORIGINAL CONTENT (Study Material):**
${originalContent.substring(0, 2000)}

**STUDENT'S EXPLANATION:**
${userExplanation}

Your task is to provide constructive, encouraging feedback on how well the student understood and explained the topic.

Analyze the student's explanation and return a JSON object with this EXACT structure:

{
  "overallScore": 85,
  "clarityScore": 90,
  "accuracyScore": 85,
  "completenessScore": 80,
  "encouragement": "A warm, personal message praising their effort and highlighting their progress",
  "strengths": [
    "Specific thing they did well #1",
    "Specific thing they did well #2",
    "Specific thing they did well #3"
  ],
  "areasToImprove": [
    "Specific, actionable suggestion #1",
    "Specific, actionable suggestion #2"
  ],
  "keyConceptsCovered": [
    "Concept A",
    "Concept B",
    "Concept C"
  ],
  "keyConceptsMissed": [
    "Concept X",
    "Concept Y"
  ],
  "analogyQuality": "Assessment of any analogies they used, or 'None used' if they didn't use any",
  "nextSteps": [
    "Concrete action they can take to improve",
    "Another helpful next step"
  ]
}

**SCORING GUIDELINES:**
- overallScore (0-100): Overall understanding - be encouraging but honest
- clarityScore (0-100): How clearly they explained concepts
- accuracyScore (0-100): How accurate their explanation was
- completenessScore (0-100): How thoroughly they covered the topic

**TONE GUIDELINES:**
- Be supportive and encouraging, not harsh
- Focus on growth and learning, not perfection
- Highlight what they did well before suggesting improvements
- Use student-friendly language
- Be specific and actionable in feedback

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no extra text.`;

    const fetchFn = global.fetch ?? (async (...args) => {
      const mod = await import('node-fetch');
      return mod.default(...args);
    });

    console.log("🤖 Calling OpenAI API for explanation feedback...");
    const response = await fetchFn("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { 
            role: "system", 
            content: "You are a supportive AI tutor that provides constructive feedback on student explanations. Always return valid JSON objects only." 
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ OpenAI API error:", response.status, errText);
      return res.status(response.status).json({ 
        error: "OpenAI API error", 
        details: errText,
        status: response.status 
      });
    }

    const data = await response.json();
    let text = data.choices?.[0]?.message?.content;
    
    if (!text) {
      console.error("❌ No content in OpenAI response:", data);
      return res.status(500).json({ 
        error: "No response from AI", 
        details: "OpenAI returned empty content" 
      });
    }

    console.log("📄 Raw AI feedback response (first 500 chars):", text.substring(0, 500));
    
    let feedback = null;
    try {
      // Clean up the response
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to extract JSON object
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        console.log("✅ Found JSON object in response");
        feedback = JSON.parse(jsonMatch[0]);
      } else {
        console.log("⚠️ No JSON object pattern found, trying direct parse");
        feedback = JSON.parse(text);
      }
      
      // Validate required fields
      const requiredFields = ['overallScore', 'clarityScore', 'accuracyScore', 'completenessScore', 'encouragement'];
      const missingFields = requiredFields.filter(field => feedback[field] === undefined);
      
      if (missingFields.length > 0) {
        console.error("❌ Missing required fields:", missingFields);
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      
      // Ensure arrays exist (with defaults)
      feedback.strengths = Array.isArray(feedback.strengths) ? feedback.strengths : ["You made a good effort to explain the concept"];
      feedback.areasToImprove = Array.isArray(feedback.areasToImprove) ? feedback.areasToImprove : ["Try to include more specific details"];
      feedback.keyConceptsCovered = Array.isArray(feedback.keyConceptsCovered) ? feedback.keyConceptsCovered : [];
      feedback.keyConceptsMissed = Array.isArray(feedback.keyConceptsMissed) ? feedback.keyConceptsMissed : [];
      feedback.nextSteps = Array.isArray(feedback.nextSteps) ? feedback.nextSteps : ["Review the material again", "Practice explaining to someone else"];
      feedback.analogyQuality = feedback.analogyQuality || "None used";
      
      // Validate score ranges
      const scores = ['overallScore', 'clarityScore', 'accuracyScore', 'completenessScore'];
      for (const scoreField of scores) {
        const score = feedback[scoreField];
        if (typeof score !== 'number' || score < 0 || score > 100) {
          console.warn(`⚠️ Invalid ${scoreField}: ${score}, defaulting to 50`);
          feedback[scoreField] = 50;
        }
      }
      
      console.log(`✅ Generated feedback with overall score: ${feedback.overallScore}%`);
      console.log("✅ Feedback validation passed");
      
    } catch (parseErr) {
      console.error("❌ JSON parse error:", parseErr.message);
      console.error("❌ Problematic text (first 1000 chars):", text.substring(0, 1000));
      
      // Return a fallback feedback response
      return res.status(500).json({ 
        error: "Failed to parse AI response", 
        details: parseErr.message,
        fallbackFeedback: {
          overallScore: 50,
          clarityScore: 50,
          accuracyScore: 50,
          completenessScore: 50,
          encouragement: "Thank you for your explanation! Keep practicing to improve your understanding.",
          strengths: ["You made an effort to explain the concept"],
          areasToImprove: ["Try to be more specific", "Include more details from the source material"],
          keyConceptsCovered: [],
          keyConceptsMissed: [],
          analogyQuality: "None used",
          nextSteps: ["Review the material again", "Practice explaining to someone else"]
        }
      });
    }
    
    // Success response
    console.log("✅ Sending successful feedback response");
    res.json({ feedback, topic: topic || "Your Topic" });
    
  } catch (err) {
    console.error("❌ Explanation feedback error:", err.message);
    console.error("❌ Stack trace:", err.stack);
    res.status(500).json({ 
      error: "Feedback generation failed", 
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;