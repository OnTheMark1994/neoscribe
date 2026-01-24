/*
  AiChatNoTokensBox

  Shows a box in the chat when the user has no tokens available.
  Displays a message and a button to get more tokens via the web portal.
*/
import React from 'react';
import { useSelector } from 'react-redux';
import './AiChatNoTokensBox.css';

const WEB_PORTAL_URL = process.env.REACT_APP_WEB_PORTAL_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL || 'http://localhost:8080';

export default function AiChatNoTokensBox() {
  const authUser = useSelector(state => state.userSlice.authUser);

  const handleGetMoreTokens = async () => {
    if (!authUser?.id) {
      console.warn('[AiChatNoTokensBox] No auth user found');
      return;
    }

    console.log('[AiChatNoTokensBox] Calling API for login token...');

    try {
      const response = await fetch(`${API_BASE_URL}/auth/generate-login-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: authUser.id }),
      });

      const data = await response.json();
      console.log('[AiChatNoTokensBox] API response:', data);

      if (!response.ok || !data.success) {
        console.error('[AiChatNoTokensBox] Failed to get login token:', data.error);
        return;
      }

      const url = `${WEB_PORTAL_URL}/#/auto-login?token=${data.loginToken}`;
      console.log('[AiChatNoTokensBox] Opening web portal at:', url);
      window.open(url, '_blank');
    } catch (err) {
      console.error('[AiChatNoTokensBox] Error:', err);
    }
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
