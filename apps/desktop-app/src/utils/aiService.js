// AI Service for ScribeFold AI
// Handles all AI-related functionality including API calls and change processing
import { WEB_PORTAL_BASE_URL, API_BASE_URL } from './constants';

// Build a normalized identity payload for backend calls.
// We explicitly track anonId, authId, and deviceId instead of a generic userId.
export function buildUserIdentity(anonId, authId = null, deviceId = null) {
  return {
    anonId: anonId || null,
    authId: authId || null,
    deviceId: deviceId || null,
  };
}

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
// 
// VISIBILITY RULES (hierarchical):
// 1. CHAPTERS (level=1):
//    - sendToAI='none': Skip chapter header AND all content inside (sections + content)
//    - sendToAI='title': Include only chapter header, skip all content inside
//    - sendToAI='all': Include chapter header, and sections inside follow their own rules
//
// 2. SECTIONS (level=2):
//    - If parent chapter is hidden ('none'), section is hidden regardless of its own setting
//    - If parent chapter is title-only, section is hidden regardless of its own setting
//    - sendToAI='none': Skip section header AND all content inside
//    - sendToAI='title': Include only section header, skip content inside
//    - sendToAI='all': Include section header and all content inside
//
// 3. CONTENT LINES (level=0):
//    - Hidden if parent chapter is hidden or title-only
//    - Hidden if parent section is hidden or title-only
//    - Otherwise included
//
export function getBookContent(lines) {
  const contentArray = [];

  // Debug logging (can be removed in production)
  const debug = false;
  const log = (msg) => { if (debug) console.log('[AI-SHARE]', msg); };

  let currentChapterMode = 'all';
  let currentSectionMode = 'all';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineMode = line.sendToAI || 'all';
    const level = line.level || 0;

    log(`--- Processing line ${i}: "${(line.text || '').substring(0, 40)}..." level=${level} mode=${lineMode}`);

    if (level === 1) {
      // New chapter starts: reset section state under it
      currentChapterMode = lineMode;
      currentSectionMode = 'all';

      if (lineMode === 'none') {
        log('  SKIP: Chapter header itself is hidden (none)');
        continue;
      }

      // 'title' or 'all' - include the chapter header
      log(`  INCLUDE: Chapter header (mode=${lineMode})`);
      contentArray.push({ id: line.id, text: line.text });
      continue;
    }

    if (level === 2) {
      // Section header belongs to current chapter
      if (currentChapterMode === 'none') {
        log('  SKIP: Section header, but parent chapter is hidden (none)');
        currentSectionMode = 'none';
        continue;
      }

      if (currentChapterMode === 'title') {
        log('  SKIP: Section header, parent chapter is title-only');
        currentSectionMode = 'none';
        continue;
      }

      // Chapter allows content; apply section's own mode
      currentSectionMode = lineMode;

      if (lineMode === 'none') {
        log('  SKIP: Section header itself is hidden (none)');
        continue;
      }

      // 'title' or 'all' - include the section header
      log(`  INCLUDE: Section header (mode=${lineMode})`);
      contentArray.push({ id: line.id, text: line.text });
      continue;
    }

    // Content line (level 0 or other)
    if (currentChapterMode === 'none') {
      log('  SKIP: Content line, parent chapter is hidden (none)');
      continue;
    }
    if (currentChapterMode === 'title') {
      log('  SKIP: Content line, parent chapter is title-only');
      continue;
    }

    if (currentSectionMode === 'none') {
      log('  SKIP: Content line, parent section is hidden (none)');
      continue;
    }
    if (currentSectionMode === 'title') {
      log('  SKIP: Content line, parent section is title-only');
      continue;
    }

    // All checks passed, include the line
    log('  INCLUDE: Content line');
    contentArray.push({ id: line.id, text: line.text });
  }

  log(`=== Final result: ${contentArray.length} lines sent to AI ===`);
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
// deviceId is optional: when provided (from desktop Electron app), enables per-device token grants
export async function fetchUserAccount(anonId, deviceId = null) {
  if (!anonId) {
    throw new Error('anonId is required to fetch user account');
  }

  const serverUrl = API_BASE_URL;
  const url = `${serverUrl}/api/users/ensure`;

  const requestBody = { anonId };
  if (deviceId) {
    requestBody.deviceId = deviceId;
  }

  const fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  };

  console.log('[USER] Calling user ensure endpoint:', url, 'with anonId:', anonId, 'deviceId:', deviceId ? '(set)' : '(none)');

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

// Fetch current token usage/availability for a user
export async function fetchUserTokens(anonId, authId = null, deviceId = null) {
  if (!anonId) {
    throw new Error('anonId is required to fetch user tokens');
  }

  const serverUrl = API_BASE_URL;
  const url = `${serverUrl}/api/user/tokens/`;

  const body = buildUserIdentity(anonId, authId, deviceId);

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

// Dev-only helper: burn a fixed number of tokens for the current user
export async function devBurnTokens(anonId, authId = null, amount) {
  if (!anonId && !authId) {
    throw new Error('anonId or authId is required to burn tokens');
  }

  const serverUrl = API_BASE_URL;
  const url = `${serverUrl}/api/dev/burn-tokens`;

  const body = {
    anonId: anonId || null,
    authId: authId || null,
    amount
  };

  console.log('[DEV] Burning tokens via:', url, 'with body:', body);

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
    throw new Error(errorPayload?.error || `Burn tokens endpoint error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[DEV] Burn tokens result:', data);
  return data;
}

// Create a new auth account and link it to the anon user
// deviceId is optional but used for abuse prevention (one auth grant per device)
export async function createUserAccount(anonId, { name, email, password, deviceId }) {
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
  
  // Include deviceId if provided (for abuse prevention during email confirmation)
  if (deviceId) {
    body.deviceId = deviceId;
  }

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
// NEW TOKEN TRACKING MODEL:
// - tokens_monthly: Current monthly allowance BALANCE (decreases as used)
// - tokens_added: Long-lived carry-over bucket (bonuses, top-ups)
// - tokens_used: Tokens used in current billing period (counter, resets monthly)
// - tokens_used_all_time: Lifetime usage counter
// FORMULA: availableTokens = tokens_monthly + tokens_added
export function normalizeUserTokenData(data) {
  if (!data) {
    return {
      tokensMonthly: 0,
      tokensUsed: 0,
      tokensAdded: 0,
      tokensUsedAllTime: 0,
      availableTokens: 0
    };
  }

  // New token fields (prefer new names, fall back to legacy)
  const tokensMonthly = Number(data.tokensMonthly ?? data.tokens_monthly ?? data.tokenLimit ?? data.token_limit ?? 0) || 0;
  const tokensUsed = Number(data.tokensUsed ?? data.tokens_used ?? 0) || 0;
  const tokensAdded = Number(data.tokensAdded ?? data.tokens_added ?? 0) || 0;
  const tokensUsedAllTime = Number(data.tokensUsedAllTime ?? data.tokens_used_all_time ?? 0) || 0;

  // New formula: available = tokens_monthly + tokens_added
  let availableTokens;
  if (data.availableTokens != null) {
    availableTokens = Number(data.availableTokens) || 0;
  } else {
    availableTokens = Math.max(0, tokensMonthly + tokensAdded);
  }

  // Extract subscription-related fields
  // tier_id stores numeric ID (1-4), subscription_tier_name has display name
  const tierId = Number(data.tier_id ?? data.subscription_tier_id ?? null) || null;
  const tierName = data.subscription_tier_name ?? data.subscriptionTierName ?? null;
  const subscriptionStatus = data.subscriptionStatus ?? data.subscription_status ?? null;
  const nextBillingDate = data.nextBillingDate ?? data.next_billing_date ?? null;

  return {
    tokensMonthly,
    tokensUsed,
    tokensAdded,
    tokensUsedAllTime,
    availableTokens,
    tierId, // Numeric tier ID (1-4)
    tierName, // Display name ('Light', 'Basic', 'Standard', 'Heavy')
    subscriptionStatus,
    nextBillingDate,
    // Legacy aliases for backward compatibility
    tokenLimit: tokensMonthly,
    subscriptionType: tierName
  };
}

// Generate unique change ID
let changeIdCounter = 0;
export function generateChangeId(lineID, type, index = 0) {
  changeIdCounter++;
  return `change_${lineID}_${type}_${index}_${changeIdCounter}`;
}

// Call DeepSeek Server API (custom server endpoint)
export async function callDeepSeekServerAPI(userPrompt, lines, anonId, authId, deviceId = null) {
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

  const identity = buildUserIdentity(anonId, authId, deviceId);

  const requestBody = {
    messages,
    ...identity,
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

/**
 * Convert AI response to Redux proposals format for View Zones
 * Groups insert changes into linesToInsert arrays
 * @param {Object} aiResponse - Raw AI response with changes array
 * @param {Array} lines - Document lines array with id and text properties
 * @returns {Object} - { [lineId]: Proposal[] } for Redux
 */
export function processChangesForRedux(aiResponse, lines = []) {
  try {
    const proposalsByLineID = {};
    
    if (!aiResponse.changes || !Array.isArray(aiResponse.changes)) {
      return { error: "No changes array found" };
    }
    
    // Build map of lineID -> original text
    const lineTextMap = {};
    lines.forEach(line => {
      if (line.id && line.text !== undefined) {
        lineTextMap[line.id] = line.text;
      }
    });
    
    // Process each change
    aiResponse.changes.forEach(change => {
      const lineID = change.lineID;
      const originalText = lineTextMap[lineID] || '';
      
      if (!proposalsByLineID[lineID]) {
        proposalsByLineID[lineID] = [];
      }
      
      // Handle different change types
      if (change.type === 'modify') {
        proposalsByLineID[lineID].push({
          id: generateChangeId(lineID, 'modify'),
          type: 'modify',
          proposedText: change.proposedText,
          originalText: originalText,
        });
      } else if (change.type === 'delete') {
        proposalsByLineID[lineID].push({
          id: generateChangeId(lineID, 'delete'),
          type: 'delete',
          originalText: originalText,
        });
      } else if (change.type === 'insert' && Array.isArray(change.linesToInsert)) {
        // Keep linesToInsert as array for View Zones
        proposalsByLineID[lineID].push({
          id: generateChangeId(lineID, 'insert'),
          type: 'insert',
          linesToInsert: change.linesToInsert,
          originalText: originalText,
        });
      }
    });
    
    return proposalsByLineID;
    
  } catch (error) {
    return {
      error: "aiResponse.changes error: " + error.message,
    };
  }
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
