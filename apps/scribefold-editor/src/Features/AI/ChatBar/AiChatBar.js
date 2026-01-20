/*
  AiChatBar

  This is the main left-side AI chat sidebar for the editor.

  High level UI:
    - Header (icon + centered title)
    - Token row (available tokens + estimate + refresh/help)
    - Scrollable message list (user + assistant)
    - Input area (prompt textarea + settings + send)

  State:
    - `aiSlice.aiModeActive` determines whether the sidebar is visible.
    - `aiSlice.messages` stores the full chat history (and optional debug data).

  Note:
    - This file is intentionally kept as a thin layout component. Most logic is pushed into
      small subcomponents (token row, message renderer, input area).
*/
import React, { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import AiChatInputArea from './AiChatInputArea';
import AiChatMessage from './AiChatMessage';
import AiChatTokenDisplay from './AiChatTokenDisplay';
import './AiChatBar.css';
export default function AiChatBar({ editorRef, originalDocRef }) {

  // Determines whether we render the chat bar at all.
  const showChatBar = useSelector(state => state.settingsSlice.settingsObject?.aiModeActive);

  // The full chat history (user + assistant + placeholder thinking messages).
  const messages = useSelector(state => state.aiSlice.messages)

  // Used to scroll to the bottom when new messages are appended.
  const messageEndRef = useRef(null);

  // Defensive: ensure we always map an array even if something put a non-array in state.
  const safeMessages = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);

  useEffect(() => {
    if (!messageEndRef.current) return;
    // Keep the chat scrolled to the newest message.
    messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages.length]);

  // If AI mode is off, do not mount anything. Changed this to try remove an error, its in another  place
  if(!showChatBar) return null

  return (
    // <div className={"aiChatBar resizable-x "+(showChatBar?"":"aiChatBarHidden")}>
    <div className={"aiChatBar resizable-x "}>
      <div className="aiChatBarHeader">
        {/* Brand icon (title is centered independently via CSS absolute positioning) */}
        <img
          src="/icon-images/scribefold-ai-icon-png.png"
          alt=""
          className="aiChatBarHeaderIcon"
        />
        {/* Title is centered across the full header width (not relative to the icon). */}
        <div className="aiChatBarHeaderTitleBox">
          <div className="aiChatBarTitle">AI Writer</div>
        </div>
      </div>

      {/* Token / usage row (reads userSlice + dispatches refresh/help actions). */}
      <AiChatTokenDisplay/>

      <div className="aiChatMessages">
        {safeMessages.length === 0 ? (
          // Empty state shown before any messages are sent.
          <div className="aiChatEmptyState">
            <div className="aiChatEmptyTitle">Ask anything</div>
            <div className="aiChatEmptySubtitle">Your messages will appear here.</div>
          </div>
        ) : (
          // Render the conversation in order.
          safeMessages.map((message, idx) => (
            <AiChatMessage
              key={message?.id ?? message?.createdAt ?? idx}
              message={message}
            />
          ))
        )}
        {/* Scroll anchor so we can always scroll to latest message. */}
        <div ref={messageEndRef} />
      </div>

      {/* Prompt input + send + settings entry point. */}
      <AiChatInputArea editorRef={editorRef} originalDocRef={originalDocRef}/>
    </div>
  );
}
