/*
  AiChatNoTokensBox

  Shows a box in the chat when the user has no tokens available.
  Displays a message and a button to get more tokens via the web portal.
*/
import React from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../../Global/SupabaseClient';
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

    console.log('[AiChatNoTokensBox] Getting current session from Supabase...');

    // Get current session from Supabase client
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.error('[AiChatNoTokensBox] No valid session:', sessionError);
      return;
    }

    const accessToken = session.access_token;
    console.log('[AiChatNoTokensBox] Access token:', accessToken.substring(0, 20) + '...');

    console.log('[AiChatNoTokensBox] Calling API for login code...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-login-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
      });

      const data = await response.json();
      console.log('[AiChatNoTokensBox] API response:', data);

      if (response.status !== 200) {
        console.error('[AiChatNoTokensBox] Failed to get login code:', data.error);
        return;
      }

      const url = `${WEB_PORTAL_URL}/#/auto-login?code=${data.login_code}`;
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
