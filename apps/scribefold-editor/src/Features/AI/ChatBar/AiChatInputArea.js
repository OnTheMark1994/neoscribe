/*
  AiChatInputArea

  Bottom input area for the AI chat sidebar.

  Responsibilities:
    - Collect the user's prompt (textarea)
    - Send on button click or Alt+Enter
    - Dispatch a user message into `aiSlice.messages`
    - Immediately dispatch a placeholder assistant "thinking" message so the UI shows a loading state

  Notes:
    - This component does not call the AI API yet; it only updates UI state.
*/
import React, { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useSelector } from 'react-redux';
import { addMessage, addProposedChanges } from '../../../Global/ReduxSlices/AiSlice';
import { setShowSettingsWindow } from '../../../Global/ReduxSlices/WindowSlice';
import { toggleShowDiffView, setShowDiffView } from '../../../Global/ReduxSlices/EditorSlice';
import { updateAvailableTokens } from '../../../Global/ReduxSlices/UserSlice';
import { getAIVisibleLinesFromEditor } from '../../../Global/EditorRefHelpers';
import { lineIdState } from '../../Editors/CodeMirror/EditorSetup';
import { supabase } from '../../../Global/SupabaseClient';
import './AiChatInputArea.css';

/**
 * Call the local scribefold-api /chat endpoint.
 *
 * Why this helper exists:
 * - Keeps the send() handler readable.
 * - Centralizes request/response parsing.
 *
 * Contract:
 * - Input: prompt string
 * - Output: response text (string)
 */
async function callChatApi(messages, userId, accessToken) {
  const endpoint = `${process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL}/api/chat`;

  // Build request debug info on the client.
  const requestBody = { messages, userId };
  const debugInfo = {
    endpoint,
    fetchRequest: {
      url: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: requestBody,
      bodyString: JSON.stringify(requestBody, null, 2),
    },
    timestamp: new Date().toISOString(),
  };

  let response;
  try {
    response = await fetch(endpoint, {
      method: debugInfo.fetchRequest.method,
      headers: debugInfo.fetchRequest.headers,
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    // Network error.
    debugInfo.networkError = true;
    debugInfo.errorMessage = err?.message || String(err);

    const error = new Error(
      `Cannot reach scribefold-api at ${endpoint}. ` +
      `Make sure apps/scribefold-api is running (node server.js) and listening on the same port. ` +
      `Original error: ${err?.message || String(err)}`
    );
    error.debugInfo = debugInfo;
    throw error;
  }

  debugInfo.status = response.status;
  debugInfo.statusText = response.statusText;

  // Parse JSON even on errors so we can capture the payload.
  const data = await response.json().catch(() => ({}));
  debugInfo.responseBody = data;

  if (!response.ok || !data?.success) {
    const serverError = data?.error || `Server error: ${response.status} ${response.statusText}`;
    const error = new Error(serverError);
    error.debugInfo = debugInfo;
    throw error;
  }

  return {
    text: String(data?.text ?? ''),
    availableTokens: data?.availableTokens,
    debugInfo,
  };
}

// Parses the text from the endpoint into a json that can be used by the application
function tryParseAiJsonResponse(text) {
  const raw = String(text ?? '');
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    const message = typeof parsed?.message === 'string' ? parsed.message : null;
    const changes = Array.isArray(parsed?.changes) ? parsed.changes : null;
    return { parsed, message, changes, error: null };
  } catch (error) {
    return { parsed: null, message: null, changes: null, error };
  }
}

export default function AiChatInputArea({ editorRef, originalDocRef }) {
  // Redux dispatch for writing messages + opening windows.
  const dispatch = useDispatch();

  // We send the full message chain for context.
  const messages = useSelector(state => state.aiSlice.messages)

  // Get auth user ID for token tracking
  const authUser = useSelector(state => state.userSlice.authUser);

  // Uncontrolled textarea ref (keeps this component simple; Redux does not store draft input).
  const inputRef = useRef(null);

  // New behavior: Accept `monacoEditorRef` so Send can pull Monaco lines and assert per-line ids
  // via helper functions in `MonacoFunctions.js`.
  async function send() {
    // Read/trim the textarea value.
    const content = String(inputRef.current?.value ?? '').trim();
    // Don't send empty messages.
    if (!content) {
      return
    };

    // Clear the input immediately.
    if (inputRef.current) inputRef.current.value = '';

    // Log full CodeMirror document text for debugging (directly from CodeMirror).
    const view = editorRef?.current;
    const fullEditorText = view?.state?.doc ? view.state.doc.toString() : '';

    const linesArray = getAIVisibleLinesFromEditor(editorRef);


    // The prompt request and also the lines of text
    const userMessageForAi = `Request: ${content} \n\n Document:\n${JSON.stringify(linesArray, null, 2)}`;

    // Append the user's message into the shared chat history.
    const userMessageId = `local_${Date.now()}`; // I don't think we need to be adding message ids but I'll leave it for now
    dispatch(addMessage({
      id: userMessageId,
      role: 'user',
      content,
      createdAt: Date.now(),
    }));

    // Add thinking message placeholder.
    dispatch(addMessage({
      id: `thinking_${Date.now()}`,
      role: 'assistant',
      content: '',
      thinking: true,
      createdAt: Date.now(),
    }));

    // Create message array and send to api.
    try {
      // Create minimal role/content message chain.
      const previousChain = Array.isArray(messages)
        ? messages
          .filter(m => m?.role === 'user' || m?.role === 'assistant')
          .filter(m => !m?.thinking)
          .map(m => ({ role: m.role, content: String(m.content ?? '') }))
        : [];

      // Put the new message into the messages array
      const outgoingMessages = [
        ...previousChain,
        { role: 'user', content: userMessageForAi },
      ];

      // Get user ID for token tracking
      const userId = authUser?.id;

      // Get access token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error('No access token available. Please log in.');
      }

      // This function calls the api and also comiles debug info
      const { text: responseText, availableTokens, debugInfo } = await callChatApi(outgoingMessages, userId, accessToken);

      // Update user data if availableTokens is provided
      if (typeof availableTokens === 'number') {
        dispatch(updateAvailableTokens(availableTokens));
      }

      // Try to parse the resonse
      const parsedResult = tryParseAiJsonResponse(responseText);

      // Fall back to the response text if the parse failed
      const assistantContent = parsedResult.message || responseText;

      // Add message to message array for display also clears "thinking"` placeholders.
      dispatch(addMessage({
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: assistantContent,
        createdAt: Date.now(),
        // Add this for the dev debug button
        debug: {
          debugInfo,
          rawResponseText: responseText,
          parsedResponse: parsedResult.parsed,
        },
      }));

      // If there are no usable proposed changes, stop here.
      if (!Array.isArray(parsedResult?.changes) || parsedResult.changes.length === 0) {
        return;
      }

      // Let a dedicated helper apply the changes to the editor and open diff view.
      processProposedChanges(editorRef, originalDocRef, parsedResult.changes);

    } catch (error) {
      console.error('[AI Chat] DeepSeek request failed:', error);

      // Display errors with a message
      dispatch(addMessage({
        id: `assistant_error_${Date.now()}`,
        role: 'assistant',
        content: `Error: ${error?.message || String(error)}`,
        createdAt: Date.now(),
        error: true,
        debug: error?.debugInfo || null,
      }));
    }
  }

  function processProposedChanges(editorRef, originalRef, proposedChanges) {
    const view = editorRef?.current;
    if (!view?.state?.doc) {
      return;
    }

    // Get the line id map so we can make changes in the rightr places based on the proposed changes 
    const doc = view.state.doc;
    const lineIdMap = view.state.field(lineIdState);

    // get the original text and put it in a ref so the diff can compare it to the modified version
    const originalText = doc.toString();
    originalRef.current = originalText;

    // Build a simple array of { lineId, text } in document order.
    const originalLines = [];
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i);
      const lineId = lineIdMap.get(line.from) || `line_${i}`;
      originalLines.push({ lineId, text: line.text });
    }

    // Normalize changes: delete/modify/insert based on lineID.
    const deleteSet = new Set();
    const modifyMap = new Map();
    const insertMap = new Map(); // lineId -> array of strings to insert after that line

    for (const rawChange of proposedChanges) {
      if (!rawChange) continue;

      const type = String(rawChange.type || '').toLowerCase();
      const lineID = rawChange.lineID ?? rawChange.lineId;
      if (!lineID) continue;

      if (type === 'delete') {
        deleteSet.add(lineID);
      } else if (type === 'modify') {
        const newText = rawChange.proposedText ?? rawChange.content ?? rawChange.newContent;
        if (typeof newText === 'string') {
          modifyMap.set(lineID, newText);
        }
      } else if (type === 'insert') {
        const linesToInsert = Array.isArray(rawChange.linesToInsert)
          ? rawChange.linesToInsert
          : [];
        if (linesToInsert.length === 0) continue;

        const existing = insertMap.get(lineID) || [];
        insertMap.set(lineID, existing.concat(linesToInsert.map(String)));
      }
    }

    const resultLines = [];

    for (const line of originalLines) {
      const { lineId, text } = line;

      if (deleteSet.has(lineId)) {
        continue;
      }

      const modifiedText = modifyMap.has(lineId) ? modifyMap.get(lineId) : text;
      resultLines.push(modifiedText);

      const insertsForLine = insertMap.get(lineId);
      if (Array.isArray(insertsForLine) && insertsForLine.length > 0) {
        for (const insertText of insertsForLine) {
          resultLines.push(insertText);
        }
      }
    }

    const resultText = resultLines.join('\n');

    // Apply the new text directly to the editor.
    view.dispatch({
      changes: {
        from: 0,
        to: doc.length,
        insert: resultText,
      },
    });

    // Store changes for Redux consumers and open the diff view.
    dispatch(addProposedChanges(proposedChanges));
    dispatch(setShowDiffView(true));
  }

  // For the Alt + Enter keypress send 
  useEffect(() => {
    function onKeyDown(e) {
      // Match the placeholder text: Alt+Enter sends.
      if (e.key === 'Enter' && e.altKey) {
        e.preventDefault();
        send();
      }
    }

    // Attach key handler directly to the textarea element.
    const el = inputRef.current;
    if (!el) return;

    el.addEventListener('keydown', onKeyDown);
    // Cleanup on unmount.
    return () => el.removeEventListener('keydown', onKeyDown);
  }, []);




  return (
    <div className="aiChatInputArea">

      {/* The input */}
      <textarea
        className="aiChatInput"
        ref={inputRef}
        placeholder="Type your prompt here... (Alt+Enter to send)"
        defaultValue="plese mod the file per the ( comments"
      />

      {/* Buttons */}
      <div className="aiChatInputButtons">

        {/* AI Settings Button */}
        <button
          className="aiChatSettingsButton"
          type="button"
          // Opens the Settings window directly to the AI tab.
          onClick={() => dispatch(setShowSettingsWindow('AI'))}
        >
          ⚙️ Settings
        </button>

        {/* Send Button */}
        <button
          className="aiChatSendButton"
          type="button"
          // Sends the user's prompt and inserts the placeholder thinking message.
          onClick={send}
        >
          Send
        </button>

      </div>
    </div>
  );
}
