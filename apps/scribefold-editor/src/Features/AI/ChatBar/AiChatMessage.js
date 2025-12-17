/*
  AiChatMessage

  Renders a single chat message in the AI sidebar.

  Behavior:
    - User messages and assistant messages share the same component, styling is controlled by role.
    - In developer mode we show a small "+" button that opens a Message Details window
      (the full message object is stored in redux and can be inspected).
    - Assistant placeholder messages with `message.thinking === true` render a "Thinking" label
      and the animated dots indicator (desktop-app parity).
*/
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setMessageDetailDisplayData } from '../../../Global/ReduxSlices/WindowSlice';
import './AiChatMessage.css';

export default function AiChatMessage({ message }) {
  // Redux dispatch is only used for opening the message detail window.
  const dispatch = useDispatch();

  // Controls whether the debug/detail button is visible.
  const devMode = useSelector(state => state.settingsSlice.settingsObject?.devMode);

  // Normalize the role for styling and labels.
  const role = message?.role === 'assistant' ? 'assistant' : 'user';

  // A local flag used to render the typing indicator for placeholder assistant messages.
  const isThinking = Boolean(message?.thinking) && role === 'assistant';

  return (
    <div className={`aiChatMessage aiChatMessage_${role} ${isThinking ? 'aiChatMessage_thinking' : ''}`}>
      {devMode ? (
        <button
          className="aiChatMessageDetailButton"
          type="button"
          title="Message details"
          // Stores this message in windowSlice so the detail Window can render it.
          onClick={() => dispatch(setMessageDetailDisplayData(message))}
        >
          +
        </button>
      ) : null}

      <div className="aiChatMessageMeta">
        {/* Meta label is purely informational (role + "Thinking" state). */}
        <div className="aiChatMessageRole">{role === 'assistant' ? (isThinking ? 'Thinking' : 'AI') : 'You'}</div>
      </div>

      <div className="aiChatMessageContent">
        {isThinking ? (
          // Placeholder assistant message: show animated dots instead of content.
          <div className="aiChatTypingIndicator" aria-label="AI is thinking">
            <span className="aiChatTypingDot" />
            <span className="aiChatTypingDot" />
            <span className="aiChatTypingDot" />
          </div>
        ) : (
          // Normal message body.
          message?.content
        )}
      </div>
    </div>
  );
}
