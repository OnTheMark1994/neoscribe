/*
  AiChatNoTokensBox

  Shows a box in the chat when the user has no tokens available.
  Displays a message and a button to get more tokens via the web portal.
*/
import React from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../../Global/SupabaseClient';
import { openUrlInBrowser } from '../../../Global/helpers/urlHelpers';
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

    console.log('[AiChatNoTokensBox] Calling /api/generate-encrypted-login-token...');

    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-encrypted-login-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
      });

      const data = await response.json();
      console.log('[AiChatNoTokensBox] API response:', data);

      if (response.status !== 200) {
        const errorText = await response.text();
        console.error('[AiChatNoTokensBox] Failed to generate token:', response.status, errorText);
        return;
      }

      const { token } = data;
      console.log('[AiChatNoTokensBox] Token generated, length:', token?.length);

      // Normalize base URL to ensure it includes a scheme (http://) to avoid browser launch errors
      const baseUrl = /^https?:\/\//i.test(WEB_PORTAL_URL) ? WEB_PORTAL_URL : `http://${WEB_PORTAL_URL}`;
      const url = `${baseUrl}/#/auto-login-magiclink-enc?token=${token}`;
      console.log('[AiChatNoTokensBox] Opening URL:', url);
      await openUrlInBrowser(url);
      console.log('[AiChatNoTokensBox] Window opened');
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
