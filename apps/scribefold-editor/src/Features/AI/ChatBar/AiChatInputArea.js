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
import { addMessage } from '../../../Global/ReduxSlices/AiSlice';
import { openSettingsWindow } from '../../../Global/ReduxSlices/WindowSlice';
import { logMonacoEditorLines } from '../../Editors/EditorMonaco/MonacoFunctions';
import './AiChatInputArea.css';

export default function AiChatInputArea({ monacoEditorRef }) {
  // Redux dispatch for writing messages + opening windows.
  const dispatch = useDispatch();

  // Uncontrolled textarea ref (keeps this component simple; Redux does not store draft input).
  const inputRef = useRef(null);

  // New behavior: Accept monacoEditorRef prop and call MonacoFunctions.logMonacoEditorLines on Send.
  // This allows us to log the current Monaco editor content when the user sends a message.
  function send() {
    // Read/trim the textarea value.
    const content = String(inputRef.current?.value ?? '').trim();
    // Don't send empty messages.
    if (!content) return;

    console.log('[AI Chat] Send:', content);

    // Debug / first-step integration:
    // When the user presses Send, log the current Monaco editor content directly.
    // This confirms:
    //   - Send button click works
    //   - The ref was passed from App -> EditorMonaco and is populated
    //   - We can access Monaco model content from outside the editor component
    logMonacoEditorLines(monacoEditorRef)

    // Append the user's message into the shared chat history.
    dispatch(addMessage({
      id: `local_${Date.now()}`,
      role: 'user',
      content,
      createdAt: Date.now(),
    }));

    // Append an assistant placeholder so we can show the "Thinking" UI immediately.
    dispatch(addMessage({
      id: `thinking_${Date.now()}`,
      role: 'assistant',
      content: '',
      thinking: true,
      createdAt: Date.now(),
    }));

    // Clear the input after sending.
    if (inputRef.current) inputRef.current.value = '';
  }

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
      <textarea
        className="aiChatInput"
        ref={inputRef}
        placeholder="Type your prompt here... (Alt+Enter to send)"
      />

      <div className="aiChatInputButtons">
        <button
          className="aiChatSettingsButton"
          type="button"
          // Opens the Settings window directly to the AI tab.
          onClick={() => dispatch(openSettingsWindow('AI'))}
        >
          ⚙️ Settings
        </button>

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
