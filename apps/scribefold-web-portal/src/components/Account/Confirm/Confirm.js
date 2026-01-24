import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Global/SupabaseClient';
import './Confirm.css';

export default function Confirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('initializing');
  const [message, setMessage] = useState('Processing your confirmation...');

  useEffect(() => {
    const processConfirmation = async () => {
      const code = searchParams.get('code');

      console.log('[Confirm] Processing confirmation with code:', code);

      if (!code) {
        setStatus('error');
        setMessage('No confirmation code found. Please check your email link.');
        return;
      }

      try {
        setStatus('processing');
        setMessage('Adding tokens to your account...');

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/verify-login-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code })
        });

        const data = await response.json();
        console.log('[Confirm] API response:', data);

        if (!data.access_token) {
          setStatus('error');
          setMessage(data.error || 'Failed to process confirmation. The link may have expired or already been used.');
          return;
        }

        console.log('[Confirm] Setting Supabase session with custom JWT...');
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: '' // No refresh token for custom JWT
        });

        setStatus('success');
        setMessage('Successfully logged in! Redirecting to your account...');

        setTimeout(() => {
          navigate('/account', { replace: true });
        }, 2000);
      } catch (error) {
        console.error('[Confirm] Error:', error);
        setStatus('error');
        setMessage('An error occurred. Please try again or contact support.');
      }
    };

    processConfirmation();
  }, [searchParams, navigate]);

  return (
    <div className="confirmContainer">
      <div className="confirmContent">
        {status === 'initializing' && (
          <div className="confirmInitializing">
            <div className="confirmIcon">⏳</div>
            <h2 className="confirmTitle">Initializing...</h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'processing' && (
          <div className="confirmProcessing">
            <div className="confirmIcon">🎁</div>
            <h2 className="confirmTitle">Adding Tokens...</h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="confirmSuccess">
            <div className="confirmIcon">✅</div>
            <h2 className="confirmTitle">Success!</h2>
            <p>{message}</p>
            <p className="confirmRedirect">Redirecting to your account...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="confirmError">
            <div className="confirmIcon">❌</div>
            <h2 className="confirmTitle">Error</h2>
            <p>{message}</p>
            <button
              className="confirmButton"
              onClick={() => navigate('/account')}
            >
              Go to Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
