import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../Global/SupabaseClient';
import './AutoLogin/AutoLogin.css';

export default function AutoLoginJWT() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('initializing');
  const [message, setMessage] = useState('Initializing auto-login...');

  useEffect(() => {
    const performAutoLogin = async () => {
      const token = searchParams.get('token');

      console.log('[AutoLoginJWT] Auto-login flow started');
      console.log('[AutoLoginJWT] Token from URL:', token);
      console.log('[AutoLoginJWT] Token structure:', {
        exists: !!token,
        length: token?.length,
        type: typeof token,
        prefix: token?.substring(0, 20) + '...'
      });

      if (!token) {
        console.warn('[AutoLoginJWT] No token found in URL params');
        setStatus('error');
        setMessage('No auto-login token found. Please log in manually.');
        return;
      }

      try {
        setStatus('validating');
        setMessage('Validating your login token...');

        console.log('[AutoLoginJWT] Calling /api/verify-login-code endpoint...');

        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/verify-login-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: token })
        });

        const data = await response.json();
        console.log('[AutoLoginJWT] API response:', data);

        if (!data.access_token) {
          console.error('[AutoLoginJWT] Failed to login:', data.error);
          setStatus('error');
          setMessage('Failed to log in. Please try again.');
          return;
        }

        console.log('[AutoLoginJWT] Setting Supabase session with custom JWT...');
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: '' // No refresh token for custom JWT
        });

        console.log('[AutoLoginJWT] Session set successfully');
        console.log('[AutoLoginJWT] Verifying session...');
        const { data: { session: verifySession }, error: verifyError } = await supabase.auth.getSession();
        console.log('[AutoLoginJWT] Session verification structure:', {
          hasSession: !!verifySession,
          hasUser: !!verifySession?.user,
          userId: verifySession?.user?.id,
          userEmail: verifySession?.user?.email,
          error: verifyError?.message
        });

        setStatus('success');
        setMessage('Login successful! Redirecting to your account...');

        setTimeout(() => {
          console.log('[AutoLoginJWT] Redirecting to /account');
          navigate('/account', { replace: true });
        }, 1500);
      } catch (err) {
        console.error('[AutoLoginJWT] Error:', err);
        console.log('[AutoLoginJWT] Error structure:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
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
