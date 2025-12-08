import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { API_BASE_URL } from '../constants';
import './ConfirmEmailPage.css';

/**
 * Email confirmation page - auto-confirms email when user clicks link from email
 * URL format: /#/confirm?token=...
 * After confirmation, redirects to /auto-login with credentials for seamless login
 */
const ConfirmEmailPage = () => {
  const [status, setStatus] = useState('confirming'); // 'confirming' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [tokensAdded, setTokensAdded] = useState(0);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [autoLoginUrl, setAutoLoginUrl] = useState(null);

  const location = useLocation();

  useEffect(() => {
    const confirmEmail = async () => {
      // Parse token from URL query params
      const params = new URLSearchParams(location.search);
      const token = params.get('token');

      if (!token) {
        setStatus('error');
        setMessage('No confirmation token found. Please check your email link.');
        return;
      }

      try {
        setStatus('confirming');
        setMessage('Confirming your email...');

        const response = await fetch(`${API_BASE_URL}/api/email/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setStatus('error');
          setMessage(data.error || 'Failed to confirm email. Please try again or request a new confirmation email.');
          return;
        }

        setStatus('success');
        setMessage(data.message || 'Email confirmed successfully!');
        setTokensAdded(data.tokensAdded || 0);
        setAlreadyConfirmed(data.alreadyConfirmed || false);
        
        // Build auto-login URL if email and password are returned
        if (data.email && data.password) {
          const loginUrl = `/auto-login?email=${encodeURIComponent(data.email)}&password=${encodeURIComponent(data.password)}`;
          setAutoLoginUrl(loginUrl);
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
            <h1>{alreadyConfirmed ? 'Already Confirmed' : 'Email Confirmed!'}</h1>
            <p className="sf-confirm-message">{message}</p>
            
            {tokensAdded > 0 && (
              <div className="sf-confirm-tokens">
                <span className="sf-confirm-tokens-amount">+{tokensAdded.toLocaleString()}</span>
                <span className="sf-confirm-tokens-label">free tokens added</span>
              </div>
            )}

            <p className="sf-confirm-instructions">
              {autoLoginUrl 
                ? 'Click the button below to go to your account.'
                : 'You can now return to the application and press refresh to see your tokens.'}
            </p>

            <div className="sf-confirm-actions">
              <Link to={autoLoginUrl || '/account'} className="sf-confirm-btn sf-confirm-btn-primary">
                Go to Account
              </Link>
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
