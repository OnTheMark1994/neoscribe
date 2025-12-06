import React, { useState, useEffect } from 'react';
import './Settings.css';
import { createUserAccount, loginUserAccount, buildWebPortalAutoLoginUrl } from '../utils/aiService';

function AccountAuthSection({
  anonId,
  authId,
  onAccountUpdated,
  onAuthCleared,
  initialEmail,
  initialPassword,
  subscriptionType,
  nextBillingDate,
}) {
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('create'); // 'create' or 'login'
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!anonId) {
      setStatus('Anonymous ID not ready yet.');
      return;
    }
    if (!authEmail || !authPassword) {
      setStatus('Email and password are required.');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      let result;
      if (authMode === 'create') {
        result = await createUserAccount(anonId, {
          name: null,
          email: authEmail,
          password: authPassword
        });
      } else {
        result = await loginUserAccount(anonId, {
          email: authEmail,
          password: authPassword
        });
      }

      const message = result && result.message
        ? result.message
        : authMode === 'create'
          ? 'Account created successfully.'
          : 'Logged in successfully.';

      setStatus(message);

      if (result && result.authUser && result.authUser.email) {
        setAuthEmail(result.authUser.email);
        try {
          localStorage.setItem('userEmail', result.authUser.email);
          if (authPassword) {
            localStorage.setItem('userPassword', authPassword);
          }
        } catch (e) {
          // ignore storage failures
        }
      }

      if (onAccountUpdated) {
        onAccountUpdated(result);
      }
    } catch (error) {
      setStatus(error.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthPassword('');
    setStatus('');
    setAuthMode('login');
    if (onAuthCleared) {
      onAuthCleared();
    }
  };

  const handleViewWebpage = () => {
    // Open the main web portal landing page in the user's browser
    openExternalLink('https://scribefold-ai-monorepo.onrender.com');
  };

  const isSignedIn = !!authId;

  const openExternalLink = async (url) => {
    try {
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
      } else {
        throw new Error('Electron API not available - cannot open externally');
      }
    } catch (error) {
      console.error('Failed to open URL externally:', error);
    }
  };

  // On mount or when authId appears, try to restore email from localStorage if we don't have one yet
  useEffect(() => {
    if (authId && !authEmail) {
      try {
        const savedEmail = localStorage.getItem('userEmail');
        if (savedEmail) {
          setAuthEmail(savedEmail);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [authId, authEmail]);

  useEffect(() => {
    if (!authEmail && initialEmail) {
      setAuthEmail(initialEmail);
    }
  }, [initialEmail, authEmail]);

  useEffect(() => {
    if (!authPassword && initialPassword) {
      setAuthPassword(initialPassword);
    }
  }, [initialPassword, authPassword]);

  return (
    <>
      {/* Subscription summary (shared for signed-in and signed-out states) */}
      <div className="stat-item">
        <span className="stat-label">Current Plan</span>
        <span className="stat-value">{subscriptionType || 'Free'}</span>
      </div>

      {nextBillingDate && (
        <div className="stat-item">
          <span className="stat-label">Next Billing Date</span>
          <span className="stat-value">
            {new Date(nextBillingDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>
      )}

      {isSignedIn ? (
        <>
          <div className="stat-item">
            <span className="stat-label">Signed in as</span>
            <span
              className="stat-value"
              style={{ display: 'block', marginTop: '4px' }}
            >
              {authEmail || 'Authenticated user'}
            </span>
          </div>

          {status && (
            <div
              style={{
                textAlign: 'center',
                marginTop: '10px',
                marginBottom: '10px',
                color: '#4CAF50',
              }}
            >
              {status}
            </div>
          )}

          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <button 
              onClick={() => openExternalLink(buildWebPortalAutoLoginUrl(authEmail, authPassword))}
              className="settings-account-portal-btn"
              style={{ 
                padding: '10px 15px',
                backgroundColor: '#4a6da7',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span>Account Portal</span>
                <span style={{ fontSize: '12px', color: '#d0d7eb', marginTop: '2px' }}>(Auto Login)</span>
              </div>
            </button>
          </div>

          <div className="auth-button-row">
            <button
              type="button"
              className="btn-secondary auth-button"
              onClick={handleViewWebpage}
              disabled={loading}
            >
              View Webpage
            </button>

            <button
              type="button"
              className="btn-primary auth-button"
              onClick={handleLogout}
              disabled={loading}
            >
              Log Out
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="setting-item">
            <label>Email</label>
            <input
              type="email"
              className="auth-input"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="setting-item">
            <label>Password</label>
            <input
              type="password"
              className="auth-input"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <div className="auth-button-row">
            <button
              type="button"
              className="btn-secondary auth-button"
              onClick={() => setAuthMode(authMode === 'create' ? 'login' : 'create')}
              disabled={loading}
            >
              {authMode === 'create' ? 'Switch to Login' : 'Switch to Create Account'}
            </button>

            <button
              type="button"
              className="btn-primary auth-button"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? (authMode === 'create' ? 'Creating...' : 'Logging in...')
                : (authMode === 'create' ? 'Create Account' : 'Log In')}
            </button>
          </div>
        </>
      )}

      {status && !isSignedIn && (
        <div className="setting-item">
          <span className="stat-value">{status}</span>
        </div>
      )}
    </>
  );
}

export default AccountAuthSection;
