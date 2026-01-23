import React, { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../constants';
import { supabase } from '../supabaseClient';
import './ConfirmEmailPage.css';

/**
 * Email confirmation page - auto-confirms email when user clicks link from email
 * URL format: /#/confirm?token=...
 * After confirmation, shows two buttons: "Go to Account" and "Go to Web App"
 * Both operations (token claiming and login) happen asynchronously
 */
const ConfirmEmailPage = () => {
  const [status, setStatus] = useState('confirming'); // 'confirming' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [tokensAdded, setTokensAdded] = useState(0);

  const location = useLocation();

  useEffect(() => {
    // This uses the token to cofirm email, add the tokens, and auto log in the user (api loggs them in and sends token)
    const confirmEmail = async () => {
      // Parse token from URL query params
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      // If no token show error message
      if (!token) {
        setStatus('error');
        setMessage('No confirmation token found. Please check your email link.');
        return;
      }

      try {
        setStatus('confirming');
        setMessage('Checking confirmation link...');

        // Send to the confirm api
        const response = await fetch(`${API_BASE_URL}/auth/claim-tokens`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        // Get data from the api
        const data = await response.json();

        // If there was an error show that
        if (!response.ok || !data.success) {
          setStatus('error');
          setMessage(data.error || 'Failed to confirm email. Please try again or request a new confirmation email.');
          return;
        }

        setStatus('success');
        setMessage(data.message || 'Email confirmed successfully!');

        console.log('[ConfirmEmailPage] API Response:', {
          success: data.success,
          message: data.message,
          hasSessionData: !!data.sessionData,
          hasAccessToken: !!data.sessionData?.access_token,
          hasRefreshToken: !!data.sessionData?.refresh_token,
          email: data.email,
          userId: data.userId
        });

        // Auto-login in background if session data is available
        if (data.sessionData) {
          console.log('[ConfirmEmailPage] Attempting auto-login with session data...');
          try {
            console.log('[ConfirmEmailPage] Calling supabase.auth.setSession...');

            const { error } = await supabase.auth.setSession({
              access_token: data.sessionData.access_token,
              refresh_token: data.sessionData.refresh_token
            });

            if (error) {
              console.error('[ConfirmEmailPage] Auto-login failed:', error);
            } else {
              console.log('[ConfirmEmailPage] Auto-login successful!');
            }
          } catch (err) {
            console.error('[ConfirmEmailPage] Auto-login exception:', err);
          }
        } else {
          console.warn('[ConfirmEmailPage] No session data available for auto-login');
        }
      } catch (err) {
        console.error('[ConfirmEmailPage] Error:', err);
        setStatus('error');
        setMessage('An error occurred while confirming your email. Please try again later.');
      }
    };

    confirmEmail();
  }, [location.search]);

  return (
    <div className="sf-confirm-page">
      <div className="sf-confirm-card">
        {status === 'confirming' && (
          <>
            <div className="sf-confirm-spinner"></div>
            <h1>Confirming Email</h1>
            <p>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="sf-confirm-icon sf-confirm-icon-success">✓</div>
            <h1>Email Confirmed!</h1>
            <p className="sf-confirm-message">{message}</p>

            <div className="sf-confirm-actions">
              <Link to="/account" className="sf-confirm-btn sf-confirm-btn-primary">
                Go to Account
              </Link>
              <a
                href="https://scribefold-ai-monorepo.onrender.com"
                target="_blank"
                rel="noopener noreferrer"
                className="sf-confirm-btn sf-confirm-btn-secondary"
              >
                Go to Web App
              </a>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="sf-confirm-icon sf-confirm-icon-error">✕</div>
            <h1>Confirmation Failed</h1>
            <p className="sf-confirm-message sf-confirm-message-error">{message}</p>

            <div className="sf-confirm-actions">
              <Link to="/account" className="sf-confirm-btn sf-confirm-btn-secondary">
                Go to Account
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ConfirmEmailPage;
