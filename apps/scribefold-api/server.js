// Minimal standalone API server used by scribefold-editor during development.
//
// Responsibilities:
// - Expose a simple health route at GET / returning "ok".
// - Expose POST /chat that forwards the user prompt to DeepSeek and returns the
//   response text to the caller.
//
// Design notes:
// - We keep the AI prompt preface in constants.js so it can be reused elsewhere
//   and so server.js stays focused on request/response control flow.
// - We use an env var for the DeepSeek key so secrets are never committed.

/*

  user signs up and confirms email: free tokens
    when not signed in on browser there is a box in the chat area with email and password that says "create & verify" 
    with a little text below saying get x free tokens by clicking link in your email
  user downloads on new device: free tokens
    actually would be way simpler to just have the email one
  sign in with google (can add later tho)

  user creates account
  email sent
  message says please confirm email
  they click the link in the email
  it brings them to web portal conform email and they get a message showing they got the tokesn
  they refresh (or auto update in app (desktop and web) would be better)
  they see their tokens
  they can then use the tokens (used in the api calls)




*/

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { PROMPT_PREFACE } = require('./constants');

const app = express();
// Default to 8080 because the editor currently targets http://localhost:8080.
// You can override via PORT in the environment if needed.
const PORT = process.env.PORT || 8080;

// Allow local dev clients (React app) to call this server.
app.use(cors());

// Parse JSON request bodies.
app.use(express.json({ limit: '2mb' }));

/**
 * Lightweight health endpoint.
 * Useful for quickly confirming the server is running.
 */
app.get('/', (req, res) => {
  res.status(200).send('ok');
});

/**
 * Calls DeepSeek's Chat Completions API.
 *
 * Why a helper:
 * - Keeps endpoint handler small.
 * - Makes it easier to reuse if we add more routes later.
 */
async function callDeepSeekChatCompletions({ messages, model = 'deepseek-chat', temperature = 0.7 }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    // Clear, actionable error so setup is straightforward.
    throw new Error('DEEPSEEK_API_KEY is missing. Add it to your environment (.env) before starting the server.');
  }

  const requestBody = {
    model,
    messages,
    stream: false,
    temperature,
  };

  // Node 18+ has fetch built-in. If you're on an older Node, upgrade to 18+.
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `DeepSeek API error: ${response.status} ${response.statusText}`;
    const err = new Error(message);
    err.status = response.status;
    err.details = errorData;
    throw err;
  }

  return response.json();
}

/**
 * POST /chat
 *
 * Contract:
 * - Input: { prompt: string }
 * - Output: { text: string }
 *
 * This keeps the editor-side integration simple: send the textbox content,
 * get back the model response text.
 */
app.post('/chat', async (req, res) => {
  try {
    const body = req.body || {};
    const incomingMessages = Array.isArray(body.messages) ? body.messages : [];
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';

    // Backwards compatible input:
    // - Preferred: { messages: [{ role, content }, ...] }
    // - Also allowed: { messages: [...], prompt: "..." } (prompt is appended as the last user message)
    // - Legacy: { prompt: "..." } (works by appending a single user message)
    if (prompt) {
      incomingMessages.push({ role: 'user', content: prompt });
    }

    if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Expected JSON body with at least one message. Example: { "messages": [{"role":"user","content":"..."}] }',
      });
    }

    // Always include the system preface.
    const messages = [
      { role: 'system', content: PROMPT_PREFACE },
      // The client is responsible for sending valid message objects.
      // We keep this intentionally simple and forward them as-is.
      ...incomingMessages,
    ];

    const requestBody = {
      model: 'deepseek-chat',
      messages,
      stream: false,
      temperature: 0.7,
    };

    const apiResponse = await callDeepSeekChatCompletions({
      messages: requestBody.messages,
      model: requestBody.model,
      temperature: requestBody.temperature,
    });

    const text = apiResponse?.choices?.[0]?.message?.content || '';

    return res.status(200).json({
      success: true,
      text,
    });
  } catch (error) {
    console.error('[POST /chat] Error:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown server error',
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`scribefold-api listening on http://localhost:${PORT}`);
  console.log(`GET  /    -> health (returns ok)`);
  console.log(`POST /chat -> DeepSeek proxy (requires DEEPSEEK_API_KEY env var)`);
});

// If the process can't bind the port (already in use, permissions, etc), show a clear error.
server.on('error', (err) => {
  console.error('[scribefold-api] Failed to start server:', err?.message || err);
  if (String(err?.code || '').toUpperCase() === 'EADDRINUSE') {
    console.error(`[scribefold-api] Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
  }
});
