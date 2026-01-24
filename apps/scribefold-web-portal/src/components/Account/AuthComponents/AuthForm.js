import React, { useState } from 'react';
import { supabase } from '../../../Global/SupabaseClient';
import './AuthForm.css';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [status, setStatus] = useState('');

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setStatus('Processing...');

    try {
      if (!supabase) {
        setStatus('Supabase not configured');
        return;
      }

      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setStatus('');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setStatus('Account created! Please check your email to confirm.');
      }
    } catch (err) {
      setStatus(err?.message || 'Authentication failed');
    }
  };

  const handleForgotPassword = () => {
    setStatus('Password reset coming soon...');
  };

  const handleNeedHelp = () => {
    setStatus('Help page coming soon...');
  };

  return (
    <form className="sf-auth-form" onSubmit={handleAuthSubmit}>
      <div className="sf-form-row">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="sf-form-row">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {status && <div className="sf-status-message">{status}</div>}
      <div className="sf-auth-actions">
        <button type="submit" className="sf-primary-btn">
          {authMode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </div>
      <div className="sf-auth-toggle">
        {authMode === 'login' ? (
          <button
            type="button"
            className="sf-link-btn"
            onClick={() => setAuthMode('signup')}
          >
            Don&apos;t have an account? Create one
          </button>
        ) : (
          <button
            type="button"
            className="sf-link-btn"
            onClick={() => setAuthMode('login')}
          >
            Already have an account? Log in
          </button>
        )}
      </div>
      <div className="sf-auth-secondary-row">
        <button
          type="button"
          className="sf-link-btn"
          onClick={handleForgotPassword}
        >
          Forgot password?
        </button>
        <span className="sf-auth-secondary-separator">•</span>
        <button
          type="button"
          className="sf-link-btn"
          onClick={handleNeedHelp}
        >
          Need help?
        </button>
      </div>
    </form>
  );
};

export default AuthForm;
