/*
  AiChatLoginBox

  Login/signup UI shown in the AI chat bar when no Supabase auth user is logged in.

  Features:
    - Email and password inputs
    - "Login" button (slate grey)
    - "Create & Verify" button (green)
    - Shows "Get 15,000 free credits sent to your email" text
*/
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supabase } from '../../../Global/SupabaseClient';
import { setAccountCreatedMessage, triggerReloadUserData } from '../../../Global/ReduxSlices/UserSlice';
import './AiChatLoginBox.css';

const API_BASE_URL = process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL || 'http://localhost:8080';

export default function AiChatLoginBox() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('');
  
  // Redux state - single object for account created message
  const accountCreatedMessage = useSelector(state => state.userSlice.accountCreatedMessage);

  // Debug logging
  console.log('[AiChatLoginBox] Supabase client:', supabase ? 'AVAILABLE' : 'NULL');
  console.log('[AiChatLoginBox] REACT_APP_SUPABASE_URL:', process.env.REACT_APP_SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('[AiChatLoginBox] REACT_APP_SUPABASE_ANON_KEY:', process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'MISSING');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setStatus('Please enter both email and password');
      return;
    }
    
    setStatus('Logging in...');
    
    try {
      if (!supabase) {
        setStatus('Supabase client not configured');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setStatus(`Error: ${error.message}`);
        return;
      }

      setStatus('Login successful!');
      setEmail('');
      setPassword('');
    } catch (error) {
      setStatus(`Error: ${error.message || 'Failed to connect to server'}`);
    }
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setStatus('Please enter both email and password');
      return;
    }
    
    setStatus('Creating account...');
    
    try {
      if (!supabase) {
        setStatus('Supabase client not configured');
        return;
      }

      // Call API server to create Supabase auth user
      const response = await fetch(`${API_BASE_URL}/auth/create-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log("createa account response", response)

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStatus(`Error: ${data.error || 'Failed to create account'}`);
        return;
      }

      // Sign in with Supabase client (persistent session)
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      console.log("signInWithPassword: ", authData)

      if (signInError) {
        setStatus(`Error: ${signInError.message}`);
        return;
      }

      setStatus(data.message || 'Account created successfully!');
      setStatusType(data.messageType || 'success');
      
      dispatch(setAccountCreatedMessage({
        message: data.message || 'Account created successfully!',
        messageType: data.messageType || 'success'
      }));

    } catch (error) {
      setStatus(`Error: ${error.message || 'Failed to connect to server'}`);
      setStatusType('error');
    }
  };

  const handleDismiss = () => {
    dispatch(setAccountCreatedMessage(null));
  };

  const handleRefresh = () => {
    dispatch(triggerReloadUserData());
    // setTimeout(() => {}, 2000);
  };

  // Account created message
  if (accountCreatedMessage) {
    const { message, messageType } = accountCreatedMessage;
    return (
      <div className="aiChatLoginBox">
        {message && (
          <div className={`aiChatLoginStatus ${
            messageType === 'error' ? 'aiChatLoginStatusError' :
            messageType === 'success' ? 'aiChatLoginStatusSuccess' :
            'aiChatLoginStatusWarning'
          }`}>
            {message}
          </div>
        )}
        <div className="aiChatLoginBoxButtons">
          <button className="aiChatLoginButton" onClick={handleRefresh}>Refresh</button>
          <button className="aiChatCreateButton" onClick={handleDismiss}>Dismiss</button>
        </div>
      </div>
    );
  }

  return (
    <div className="aiChatLoginBox">
      <div className="aiChatLoginBoxTitle">
        Get 15,000 free credits sent to your email
        (Creates account then sends link to email)
      </div>

      <div className="aiChatLoginBoxInputs">
        <input
          type="email"
          className="aiChatLoginInput"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="aiChatLoginInput"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {status && (
        <div className={`aiChatLoginStatus ${
          statusType === 'error' ? 'aiChatLoginStatusError' :
          statusType === 'success' ? 'aiChatLoginStatusSuccess' :
          'aiChatLoginStatusWarning'
        }`}>
          {status}
        </div>
      )}

      <div className="aiChatLoginBoxButtons">
        <button
          className="aiChatLoginButton"
          type="button"
          onClick={handleLogin}
        >
          Login
        </button>
        <button
          className="aiChatCreateButton"
          type="button"
          onClick={handleCreateAccount}
        >
          Create & Verify
        </button>
      </div>
    </div>
  );
}
