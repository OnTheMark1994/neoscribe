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
import { useDispatch } from 'react-redux';
import './AiChatLoginBox.css';

export default function AiChatLoginBox() {
  const dispatch = useDispatch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState(''); // For error/success messages

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setStatus('Please enter both email and password');
      return;
    }
    
    setStatus('Logging in...');
    // TODO: Implement login logic
    console.log('Login clicked:', { email, password });
  };

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setStatus('Please enter both email and password');
      return;
    }
    
    setStatus('Creating account...');
    // TODO: Implement create account logic
    console.log('Create account clicked:', { email, password });
  };

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
          status.includes('Error') ? 'aiChatLoginStatusError' : 
          status.includes('success') || status.includes('Creating') || status.includes('Logging') ? 'aiChatLoginStatusSuccess' : 
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
