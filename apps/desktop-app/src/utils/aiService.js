// AI Service for ScribeFold AI
// Handles all AI-related functionality including API calls and change processing
import { WEB_PORTAL_BASE_URL, API_BASE_URL } from './constants';

export function buildWebPortalAutoLoginUrl(email, password) {
  const safeEmail = email || '';
  const safePassword = password || '';
  return `${WEB_PORTAL_BASE_URL}/#/auto-login?email=${encodeURIComponent(safeEmail)}&password=${encodeURIComponent(safePassword)}`;
}

// Default prompt preface
export const DEFAULT_PROMPT_PREFACE = `You are an AI writing assistant for ScribeFold AI.

DOCUMENT FORMAT:
You receive the document as a simple list where each line has:
- id: A unique identifier (like "x7k9m2p4")
- text: The line's content

CRITICAL RULES:
1. ONLY make changes the user explicitly requests
2. DO NOT delete blank lines, fix formatting, or "clean up" the document
3. DO NOT modify lines unless specifically asked
4. When adding multiple consecutive lines, put them ALL in ONE "linesToInsert" array

FORMATTING:
- Lines starting with "#chapter" or "#section" are headers
- Other lines are regular content
- Blank lines are intentional - do not remove them
- When you insert after a lineID, the new lines go immediately after that specific line

RESPONSE FORMAT - Respond with ONLY valid JSON:
{
  "message": "Brief explanation of what you did",
  "changes": [
    {
      "type": "modify",
      "lineID": "x7k9m2p4",
      "proposedText": "updated text for this line"
    },
    {
      "type": "delete",
      "lineID": "x3a5b7c9"
    },
    {
      "type": "insert",
      "lineID": "x9d2f4g6",
      "linesToInsert": ["First new line", "Second new line", "Third new line"]
    }
  ]
}

IMPORTANT:
- Use the exact lineID from the document
- For "insert", ALL consecutive lines go in ONE linesToInsert array
- Respond with ONLY the JSON, no markdown formatting`;

// Get prompt preface from localStorage or use default
export function getPromptPreface() {
  return localStorage.getItem('promptPreface') || DEFAULT_PROMPT_PREFACE;
}

// Get book content for AI - returns as JSON array
export function getBookContent(lines) {
  const contentArray = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Include ALL lines with their IDs so AI can reference them correctly
    contentArray.push({ id: line.id, text: line.text });
  }
  
  return contentArray;
}

// Estimate token count (rough approximation: ~4 characters per token)
export function estimateTokens(text) {
  if (!text) return 0;
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const charEstimate = Math.ceil(charCount / 4);
  const wordEstimate = Math.ceil(wordCount * 1.3);
  return Math.ceil((charEstimate + wordEstimate) / 2);
}

// Calculate full token estimate for AI request
export function calculateFullTokenEstimate(lines) {
  const systemPrompt = getPromptPreface();
  const systemTokens = estimateTokens(systemPrompt);
  
  const content = getBookContent(lines);
  const contentString = JSON.stringify(content);
  const contentTokens = estimateTokens(contentString);
  
  const avgUserMessageTokens = 50;
  const avgResponseTokens = 800;
  
  const totalEstimate = systemTokens + contentTokens + avgUserMessageTokens + avgResponseTokens;
  
  return {
    system: systemTokens,
    content: contentTokens,
    userMessage: avgUserMessageTokens,
    response: avgResponseTokens,
    total: totalEstimate
  };
}

// Ensure user exists and fetch user account data by anonId
export async function fetchUserAccount(anonId) {
  if (!anonId) {
    throw new Error('anonId is required to fetch user account');
  }

  const serverUrl = API_BASE_URL;
  const url = `${serverUrl}/api/users/ensure`;

  const requestBody = { anonId };

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  };

  console.log('[USER] Calling user ensure endpoint:', url, 'with anonId:', anonId);

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (_) {
      // ignore JSON parse errors
    }
    console.error('[USER] User ensure endpoint failed:', response.status, response.statusText, errorPayload);
    throw new Error(errorPayload?.error || `User endpoint error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[USER] Loaded user account data:', data);
  return data;
}

// Fetch current token usage/availability for a user by anonId
export async function fetchUserTokens(anonId, authId = null) {
  if (!anonId) {
    throw new Error('anonId is required to fetch user tokens');
  }

  const serverUrl = API_BASE_URL;
  const url = `${serverUrl}/api/user/tokens/`;

  const body = {
    userId: anonId,
    authId: authId || null,
  };

  console.log('[USER] Fetching user tokens from:', url, 'with body:', body);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error('[USER] User tokens endpoint failed:', response.status, response.statusText);
    throw new Error(`User tokens endpoint error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[USER] Loaded user tokens raw:', data);
  const normalized = normalizeUserTokenData(data);
  console.log('[USER] Normalized user tokens:', normalized);
  return { ...data, ...normalized };
}

// Create a new auth account and link it to the anon user
export async function createUserAccount(anonId, { name, email, password }) {
  if (!anonId) {
    throw new Error('anonId is required to create user account');
  }

  const serverUrl = API_BASE_URL;
  const url = `${serverUrl}/api/users/create-account`;

  const body = {
    anonId,
    name: name || null,
    email,
    password
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (_) {
      // ignore
    }
    throw new Error(errorPayload?.error || `Create account endpoint error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[USER] Create account result:', data);
  return data;
}

// Login to an existing auth account and link it to the anon user (no bonus tokens)
export async function loginUserAccount(anonId, { email, password }) {
  if (!anonId) {
    throw new Error('anonId is required to login');
  }

  const serverUrl = API_BASE_URL;
  const url = `${serverUrl}/api/users/login`;

  const body = {
    anonId,
    email,
    password
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let errorPayload = null;
    try {
      errorPayload = await response.json();
    } catch (_) {
      // ignore
    }
    throw new Error(errorPayload?.error || `Login endpoint error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[USER] Login result:', data);
  return data;
}

// Normalize token-related fields from backend (handles int8/BIGINT as strings)
// Accepts both camelCase and snake_case field names
export function normalizeUserTokenData(data) {
  if (!data) {
    return {
      tokenLimit: 0,
      tokensUsed: 0,
      tokensAdded: 0,
      tokensUsedAllTime: 0,
      availableTokens: 0
    };
  }

  const tokenLimit = Number(data.tokenLimit ?? data.token_limit ?? 0) || 0;
  const tokensUsed = Number(data.tokensUsed ?? data.tokens_used ?? 0) || 0;
  const tokensAdded = Number(data.tokensAdded ?? data.tokens_added ?? 0) || 0;
  const tokensUsedAllTime = Number(data.tokensUsedAllTime ?? data.tokens_used_all_time ?? 0) || 0;

  let availableTokens;
  if (data.availableTokens != null) {
    availableTokens = Number(data.availableTokens) || 0;
  } else {
    availableTokens = Math.max(0, tokenLimit - tokensUsed + tokensAdded);
  }

  // Extract subscription-related fields
  // Use subscription_tier_name for display (e.g., 'Light', 'Standard')
  // subscription_type now stores tier_id (1-4) on backend
  const subscriptionType = data.subscription_tier_name ?? data.subscriptionTierName ?? null;
  const subscriptionStatus = data.subscriptionStatus ?? data.subscription_status ?? null;
  const nextBillingDate = data.nextBillingDate ?? data.next_billing_date ?? null;

  return {
    tokenLimit,
    tokensUsed,
    tokensAdded,
    tokensUsedAllTime,
    availableTokens,
    subscriptionType, // Now contains display name ('Light', 'Basic', 'Standard', 'Heavy')
    subscriptionStatus,
    nextBillingDate
  };
}

// Generate unique change ID
let changeIdCounter = 0;
export function generateChangeId(lineID, type, index = 0) {
  changeIdCounter++;
  return `change_${lineID}_${type}_${index}_${changeIdCounter}`;
}

// Call DeepSeek Server API (custom server endpoint)
export async function callDeepSeekServerAPI(userPrompt, lines, anonId, authId) {
  const bookContent = getBookContent(lines);
  const systemPrompt = getPromptPreface();

  const userMessage = `Document:
${JSON.stringify(bookContent)}

Request: ${userPrompt}`;

  const serverUrl = API_BASE_URL;
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage }
  ];

  const requestBody = {
    messages: messages,
    userId: anonId || 'anon_default',
    authId: authId || null,
    temperature: 0.7,
    model: 'deepseek-chat'
  };

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  };

  const debugInfo = {
    serverUrl: serverUrl,
    endpoint: `${serverUrl}/api/deepseek/query`,
    fetchRequest: {
      url: `${serverUrl}/api/deepseek/query`,
      method: fetchOptions.method,
      headers: fetchOptions.headers,
      body: requestBody,
      bodyString: JSON.stringify(requestBody, null, 2)
    },
    timestamp: new Date().toISOString()
  };

  try {
    const response = await fetch(`${serverUrl}/api/deepseek/query`, fetchOptions);

    debugInfo.status = response.status;
    debugInfo.statusText = response.statusText;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      debugInfo.errorResponse = errorData;
      const error = new Error(errorData.error || `Server error: ${response.status}`);
      error.debugInfo = debugInfo;
      throw error;
    }

    const data = await response.json();
    debugInfo.response = data;
    
    if (!data.success) {
      const error = new Error(data.error || 'Server returned unsuccessful response');
      error.debugInfo = debugInfo;
      throw error;
    }
    
    const aiResponse = data.response;
    
    // Parse the JSON response
    let parsedResponse;
    try {
      const cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      debugInfo.parseError = parseError.message;
      const error = new Error('AI response was not valid JSON. Please try again.');
      error.debugInfo = debugInfo;
      throw error;
    }

    // Validate response format
    if (!parsedResponse.message || !Array.isArray(parsedResponse.changes)) {
      debugInfo.validationError = 'Missing required fields';
      const error = new Error('AI response missing required fields');
      error.debugInfo = debugInfo;
      throw error;
    }

    // Add token usage info to debug data if available
    if (data.tokenUsage) {
      debugInfo.tokenUsage = data.tokenUsage;
      console.log('Token usage:', data.tokenUsage);
    }

    return { raw: aiResponse, parsed: parsedResponse, debugInfo, requestBody };
  } catch (error) {
    console.error('DeepSeek Server API error:', error);
    
    // Check if it's a network error
    if (error.message.includes('fetch') || error.name === 'TypeError' || !navigator.onLine) {
      debugInfo.networkError = true;
      const netError = new Error(`Cannot connect to server at ${serverUrl}. Make sure the server is running.`);
      netError.debugInfo = debugInfo;
      throw netError;
    }
    
    if (!error.debugInfo) {
      error.debugInfo = debugInfo;
    }
    
    throw error;
  }
}

// Process changes from AI response with error handling
export function processChanges(aiResponse) {
  try {
    const changesByLineID = {};
    
    if (!aiResponse.changes || !Array.isArray(aiResponse.changes)) {
      return { error: "No changes array found" };
    }
    
    // Process each change
    aiResponse.changes.forEach(change => {
      const lineID = change.lineID;
      
      if (!changesByLineID[lineID]) {
        changesByLineID[lineID] = [];
      }
      
      // Handle different change types
      if (change.type === 'modify') {
        changesByLineID[lineID].push({
          id: generateChangeId(lineID, 'modify'),
          type: 'modify',
          content: change.proposedText
        });
      } else if (change.type === 'delete') {
        changesByLineID[lineID].push({
          id: generateChangeId(lineID, 'delete'),
          type: 'delete',
          content: null
        });
      } else if (change.type === 'insert' && Array.isArray(change.linesToInsert)) {
        change.linesToInsert.forEach((lineText, index) => {
          changesByLineID[lineID].push({
            id: generateChangeId(lineID, 'insert', index),
            type: 'insert',
            content: lineText
          });
        });
      }
    });
    
    return changesByLineID;
    
  } catch (error) {
    return {
      error: "aiResponse.changes error: " + error.message,
    };
  }
}

// Generate line ID (matches original implementation)
function generateLineId() {
  return Math.random().toString(36).substr(2, 9);
}

// Integrate changes into lines array (matches original implementation exactly)
export function integrateChangesIntoLines(changesByLineID, currentLines) {
  const integratedLines = [];
  
  for (let i = 0; i < currentLines.length; i++) {
    const line = currentLines[i];
    const changesForLine = changesByLineID[line.id];
    
    if (changesForLine && Array.isArray(changesForLine)) {
      // Process each change for this line
      changesForLine.forEach(change => {
        if (change.type === 'modify') {
          // Add line with modify proposal properties
          integratedLines.push({
            ...line,
            proposedChangeType: 'modify',
            proposedChangeId: generateLineId(),
            modifyFrom: line.text,
            modifyTo: change.content
          });
        } else if (change.type === 'delete') {
          // Add line with delete proposal properties
          integratedLines.push({
            ...line,
            proposedChangeType: 'delete',
            proposedChangeId: generateLineId()
          });
        } else if (change.type === 'insert') {
          // First add the current line if not already added
          if (!integratedLines.includes(line) && !changesForLine.some(c => c.type === 'modify' || c.type === 'delete')) {
            integratedLines.push(line);
          }
          
          // Then add the insert proposal as a new line
          const insertId = generateLineId();
          integratedLines.push({
            text: change.content,
            proposedChangeType: 'insert',
            proposedChangeId: insertId,
            id: insertId,
            open: true,
            level: 0,
            startIdx: -1,
            endIdx: -1,
            sendToAI: 'all'
          });
        }
      });
      
      // If line was modified or deleted, we already added it above
      // If it only has inserts, we added it in the insert block
      // Skip adding it again
      const hasModifyOrDelete = changesForLine.some(c => c.type === 'modify' || c.type === 'delete');
      if (hasModifyOrDelete) {
        continue;
      }
      const hasOnlyInserts = changesForLine.every(c => c.type === 'insert');
      if (hasOnlyInserts) {
        continue;
      }
    } else {
      // No changes for this line, add it as-is
      integratedLines.push(line);
    }
  }
  
  return integratedLines;
}
