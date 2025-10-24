const express = require('express');
const router = express.Router();

// POST /api/ai/send-content
// Body: { contents: ["text1","text2",...], prompt?: "optional custom prompt", model?: "gpt-3.5-turbo" }
router.post('/send-content', async (req, res) => {
	// small validation
	const { contents, prompt, model = 'gpt-3.5-turbo' } = req.body || {};
	if (!contents || !Array.isArray(contents) || contents.length === 0) {
		return res.status(400).json({ error: 'No contents provided. Send { contents: ["..."] }' });
	}

	const combinedText = contents.join('\n\n');

	// Default dummy prompt to verify the model received the text.
	const dummyPrompt = `DUMMY CHECK: I have the extracted text below. First, reply with a single line "RECEIVED" if you got the text. 
Then on the next line give a very short (<=20 words) summary. 
Finally, on the third line, suggest the single next step the user should take (one sentence).

--- extracted content start ---
${combinedText}
--- extracted content end ---`;

	const userMessage = prompt && typeof prompt === 'string' ? prompt + '\n\n' + combinedText : dummyPrompt;

	const messages = [
		{ role: 'system', content: 'You are a helpful assistant that summarizes and confirms received extracted content.' },
		{ role: 'user', content: userMessage }
	];

	try {
		// Use global fetch if available, otherwise dynamically import node-fetch
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
				temperature: 0.2,
				max_tokens: 400
			})
		});

		if (!resp.ok) {
			const errText = await resp.text();
			return res.status(resp.status).json({ error: 'OpenAI error', details: errText });
		}

		const data = await resp.json();
		const assistant = data.choices?.[0]?.message?.content ?? null;
		return res.json({ assistant, raw: data });
	} catch (err) {
		console.error('AI route error:', err);
		return res.status(500).json({ error: 'Failed to call OpenAI', details: err.message });
	}
});

module.exports = router;