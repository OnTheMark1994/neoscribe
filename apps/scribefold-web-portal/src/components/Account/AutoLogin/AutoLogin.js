import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../Global/SupabaseClient';

export default function AutoLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('initializing');
  const [message, setMessage] = useState('Initializing auto-login...');

  useEffect(() => {
    const performAutoLogin = async () => {
      const tokenHash = searchParams.get('token_hash');

      console.log('[AutoLogin] Auto-login flow started');
      console.log('[AutoLogin] Token hash from URL:', tokenHash);

      if (!tokenHash) {
        console.warn('[AutoLogin] No token_hash found in URL params');
        setStatus('error');
        setMessage('No auto-login token found. Please log in manually.');
        return;
      }

      try {
        setStatus('validating');
        setMessage('Validating your login token...');

        console.log('[AutoLogin] Calling supabase.auth.verifyOtp with token_hash...');

        // Use Supabase client to verify the OTP and create a session
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'magiclink'
        });

        if (verifyError) {
          console.error('[AutoLogin] Failed to verify OTP:', verifyError);
          setStatus('error');
          setMessage('Failed to log in. Please try again.');
          return;
        }

        console.log('[AutoLogin] OTP verified successfully');
        console.log('[AutoLogin] Session present:', !!verifyData.session);

        if (!verifyData.session) {
          console.error('[AutoLogin] No session created');
          setStatus('error');
          setMessage('Failed to log in. Please try again.');
          return;
        }

        setStatus('success');
        setMessage('Login successful! Redirecting to your account...');

        // Redirect to account page after a short delay
        setTimeout(() => {
          console.log('[AutoLogin] Redirecting to /account');
          navigate('/account', { replace: true });
        }, 1500);
      } catch (err) {
        console.error('[AutoLogin] Error:', err);
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
