import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../Global/SupabaseClient';
import './AutoLogin/AutoLogin.css';

export default function AutoLoginMagicLinkEnc() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('initializing');
  const [message, setMessage] = useState('Initializing encrypted auto-login...');
  const isProcessing = useRef(false);

  useEffect(() => {
    const performAutoLogin = async () => {
      // Prevent duplicate calls from React StrictMode
      if (isProcessing.current) {
        console.log('[AutoLoginMagicLinkEnc] Already processing, skipping duplicate call');
        return;
      }
      isProcessing.current = true;

      const token = searchParams.get('token');

      console.log('[AutoLoginMagicLinkEnc] Auto-login flow started');
      console.log('[AutoLoginMagicLinkEnc] Token from URL:', { exists: !!token, length: token?.length, prefix: token?.slice(0, 10) });

      if (!token) {
        console.warn('[AutoLoginMagicLinkEnc] No token found in URL params');
        setStatus('error');
        setMessage('No auto-login token found. Please log in manually.');
        return;
      }

      try {
        setStatus('validating');
        setMessage('Validating your encrypted login token...');

        console.log('[AutoLoginMagicLinkEnc] Calling /auto/auto-login-magiclink-enc endpoint...');

        const response = await fetch(`${process.env.REACT_APP_API_URL}/auto/auto-login-magiclink-enc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        console.log('[AutoLoginMagicLinkEnc] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.log('[AutoLoginMagicLinkEnc] Error text:', errorText);
          throw new Error(`API error: ${response.status}`);
        }

        const { token_hash, type } = await response.json();
        console.log('[AutoLoginMagicLinkEnc] API response:', { token_hashPrefix: token_hash?.slice(0, 10), type });

        console.log('[AutoLoginMagicLinkEnc] Verifying OTP with Supabase...');
        const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
        console.log('[AutoLoginMagicLinkEnc] verifyOtp result:', { userId: data?.user?.id, error: error?.message });

        if (error) {
          console.error('[AutoLoginMagicLinkEnc] verifyOtp failed:', error);
          setStatus('error');
          setMessage('Failed to verify magic link. Please try again.');
          return;
        }

        console.log('[AutoLoginMagicLinkEnc] OTP verified successfully');
        console.log('[AutoLoginMagicLinkEnc] User:', data.user);

        setStatus('success');
        setMessage('Login successful! Redirecting to your account...');

        setTimeout(() => {
          console.log('[AutoLoginMagicLinkEnc] Redirecting to /account');
          navigate('/account', { replace: true });
        }, 1500);
      } catch (err) {
        console.error('[AutoLoginMagicLinkEnc] Error:', err.message);
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
