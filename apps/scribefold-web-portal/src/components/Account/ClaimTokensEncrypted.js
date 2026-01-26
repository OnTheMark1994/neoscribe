import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../Global/SupabaseClient';
import './AutoLogin/AutoLogin.css';

const API_BASE_URL = process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL || 'http://localhost:8080';

export default function ClaimTokensEncrypted() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('initializing');
  const [message, setMessage] = useState('Initializing token claim...');
  const isProcessing = useRef(false);

  useEffect(() => {
    const performClaim = async () => {
      // Prevent duplicate calls from React StrictMode
      if (isProcessing.current) {
        console.log('[ClaimTokensEncrypted] Already processing, skipping duplicate call');
        return;
      }
      isProcessing.current = true;

      const token = searchParams.get('token');

      console.log('[ClaimTokensEncrypted] Token claim started');
      console.log('[ClaimTokensEncrypted] Token from URL:', { exists: !!token, length: token?.length, prefix: token?.slice(0, 10) });

      if (!token) {
        console.warn('[ClaimTokensEncrypted] No token found in URL params');
        setStatus('error');
        setMessage('No token found. Please request a new token email.');
        return;
      }

      try {
        setStatus('claiming');
        setMessage('Claiming your free tokens...');

        console.log('[ClaimTokensEncrypted] Calling /auth/claim-tokens-encrypted endpoint...');

        const response = await fetch(`${API_BASE_URL}/auth/claim-tokens-encrypted`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        console.log('[ClaimTokensEncrypted] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.log('[ClaimTokensEncrypted] Error text:', errorText);
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('[ClaimTokensEncrypted] API response:', data);

        if (!data.success) {
          setStatus('error');
          setMessage(data.error || 'Failed to claim tokens');
          return;
        }

        console.log('[ClaimTokensEncrypted] Tokens claimed successfully');
        console.log('[ClaimTokensEncrypted] Tokens added:', data.tokensAdded);

        // Auto-login using magic link flow
        if (data.token_hash && data.type) {
          console.log('[ClaimTokensEncrypted] Verifying OTP with Supabase...');
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: data.type });
          console.log('[ClaimTokensEncrypted] verifyOtp result:', { userId: verifyData?.user?.id, error: verifyError?.message });

          if (verifyError) {
            console.error('[ClaimTokensEncrypted] verifyOtp error:', verifyError);
            setStatus('error');
            setMessage('Tokens added but auto-login failed. Please log in manually.');
            return;
          }
        }

        setStatus('success');
        setMessage(`${data.message} Redirecting to your account...`);

        setTimeout(() => {
          console.log('[ClaimTokensEncrypted] Redirecting to /account');
          navigate('/account', { replace: true });
        }, 2000);
      } catch (err) {
        console.error('[ClaimTokensEncrypted] Error:', err.message);
        setStatus('error');
        setMessage('An error occurred while claiming tokens. Please try again.');
      }
    };

    performClaim();
  }, [searchParams, navigate]);

  return (
    <div className="autoLoginContainer">
      <div className="autoLoginContent">
        <h2 className="autoLoginTitle">
          {status === 'success' ? '✓ Tokens Claimed!' : status === 'error' ? '✗ Error' : 'Claiming Tokens...'}
        </h2>
        <p className="autoLoginMessage">{message}</p>
        {status === 'success' && (
          <div className="autoLoginSuccess">
            <p>You can now use your tokens to chat with the AI!</p>
          </div>
        )}
        {status === 'error' && (
          <div className="autoLoginError">
            <p>Please request a new token email from the editor or contact support.</p>
          </div>
        )}
      </div>
    </div>
  );
}
