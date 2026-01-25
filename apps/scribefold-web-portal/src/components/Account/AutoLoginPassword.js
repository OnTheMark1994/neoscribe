import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../Global/SupabaseClient';
import './AutoLogin/AutoLogin.css';

export default function AutoLoginPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('initializing');
  const [message, setMessage] = useState('Initializing auto-login...');

  useEffect(() => {
    const performAutoLogin = async () => {
      const token = searchParams.get('token');

      console.log('[AutoLoginPassword] Auto-login flow started');
      console.log('[AutoLoginPassword] Token from URL:', token);

      if (!token) {
        console.warn('[AutoLoginPassword] No token found in URL params');
        setStatus('error');
        setMessage('No auto-login token found. Please log in manually.');
        return;
      }

      try {
        setStatus('validating');
        setMessage('Validating your login token...');

        console.log('[AutoLoginPassword] Calling /auth/token-login endpoint...');

        const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/token-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = await response.json();
        console.log('[AutoLoginPassword] API response:', data);

        if (!data.success || !data.session) {
          console.error('[AutoLoginPassword] Failed to login:', data.error);
          setStatus('error');
          setMessage('Failed to log in. Please try again.');
          return;
        }

        console.log('[AutoLoginPassword] Setting Supabase session...');
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        setStatus('success');
        setMessage('Login successful! Redirecting to your account...');

        setTimeout(() => {
          console.log('[AutoLoginPassword] Redirecting to /account');
          navigate('/account', { replace: true });
        }, 1500);
      } catch (err) {
        console.error('[AutoLoginPassword] Error:', err);
        setStatus('error');
        setMessage('An error occurred during auto-login. Please try again.');
      }
    };

    performAutoLogin();
  }, [searchParams, navigate]);

  return (
    <div className="autoLoginContainer">
      <div className="autoLoginContent">
        {status === 'initializing' && (
          <div className="autoLoginInitializing">
            <div className="autoLoginIcon">⏳</div>
            <h2 className="autoLoginTitle">Initializing...</h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'validating' && (
          <div className="autoLoginValidating">
            <div className="autoLoginIcon">🔐</div>
            <h2 className="autoLoginTitle">Validating...</h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="autoLoginSuccess">
            <div className="autoLoginIcon">✅</div>
            <h2 className="autoLoginTitle">Success!</h2>
            <p>{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="autoLoginError">
            <div className="autoLoginIcon">❌</div>
            <h2 className="autoLoginTitle">Error</h2>
            <p>{message}</p>
            <button
              className="autoLoginButton"
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
