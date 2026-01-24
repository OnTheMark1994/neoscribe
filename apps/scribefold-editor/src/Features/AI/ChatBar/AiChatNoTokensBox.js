/*
  AiChatNoTokensBox

  Shows a box in the chat when the user has no tokens available.
  Displays a message and a button to get more tokens via the web portal.
*/
import React from 'react';
import { useSelector } from 'react-redux';
import './AiChatNoTokensBox.css';

const WEB_PORTAL_URL = 'https://scribefold-ai-monorepo.onrender.com';

export default function AiChatNoTokensBox() {
  const authUser = useSelector(state => state.userSlice.authUser);

  const handleGetMoreTokens = () => {
    // Open web portal in new tab with auto-sign-in
    const url = `${WEB_PORTAL_URL}/#/account`;
    window.open(url, '_blank');
  };

  return (
    <div className="aiChatNoTokensBox">
      <div className="aiChatNoTokensMessage">
        You've used all your available tokens. Get more to continue using the AI.
      </div>
      <button
        className="aiChatNoTokensButton"
        type="button"
        onClick={handleGetMoreTokens}
      >
        Get More Tokens
        <span className="aiChatNoTokensIcon">↗</span>
      </button>
    </div>
  );
}
