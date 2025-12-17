import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import './Settings.css';
import { createUserAccount, loginUserAccount, buildWebPortalAutoLoginUrl } from '../../utils/aiService';
import { selectAuthUser, selectDeviceId, setAuthUser } from '../../store/userSlice';

function AccountAuthSection({
  anonId,
  onAccountUpdated,
  subscriptionType,
  nextBillingDate,
}) {
  const dispatch = useDispatch();
  const authUser = useSelector(selectAuthUser);
  const deviceId = useSelector(selectDeviceId);

  const emailInputRef = useRef(null);
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('create'); // 'create' or 'login'
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const emailValue = emailInputRef.current?.value?.trim() || '';
    const passwordValue = authPassword.trim();

    if (!anonId) {
      setStatus('Anonymous ID not ready yet.');
      return;
    }
    if (!emailValue || !passwordValue) {
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
          email: emailValue,
          password: passwordValue,
          deviceId: deviceId || null  // Pass deviceId for abuse prevention
        });
      } else {
        result = await loginUserAccount(anonId, {
          email: emailValue,
          password: passwordValue,
        });
      }

      const message = result && result.message
        ? result.message
        : authMode === 'create'
          ? 'Account created successfully.'
          : 'Logged in successfully.';

      setStatus(message);

      if (result && result.authUser) {
        // Update Redux authUser so the rest of the app has a single source of truth
        dispatch(setAuthUser(result.authUser));
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
    // Clear local auth state and reset UI
    setAuthPassword('');
    setStatus('');
    setAuthMode('login');

    // Clear Redux authUser so UI and API calls stop treating user as authenticated
    dispatch(setAuthUser(null));
  };

  const handleViewWebpage = () => {
    // Open the main web portal landing page in the user's browser
    openExternalLink('https://scribefold-ai-monorepo.onrender.com');
  };

  const isSignedIn = !!authUser;
  const isFreePlan = !subscriptionType || String(subscriptionType).toLowerCase() === 'free';

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

  useEffect(() => {
    // When authUser changes, ensure the email input (when visible) defaults to the authUser email
    if (authUser && authUser.email && emailInputRef.current) {
      if (!emailInputRef.current.value) {
        emailInputRef.current.value = authUser.email;
      }
    }
  }, [authUser]);

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
      {/* Helper banners under subscription summary */}
      {/* 1) Anon users: prompt to create a free account */}
      {!isSignedIn && (
        <div className="auth-info-message">
          Create a free one click account for additional free tokens and to see subscription options.
        </div>
      )}
      {/* 2) Signed-in users on Free plan: prompt to open Account Portal for subscription options */}
      {isSignedIn && isFreePlan && (
        <div className="auth-info-message">
          Click Account Portal to view subscription options.
        </div>
      )}

      {isSignedIn ? (
        <>
          <div className="stat-item">
            <span className="stat-label">Signed in as</span>
            <span className="stat-value auth-signed-in-email">
              {authUser?.email || 'Authenticated user'}
            </span>
          </div>

          {status && (
            <div className="auth-status-message">
              {status}
            </div>
          )}

          <div className="account-portal-container">
            <button 
              onClick={() => openExternalLink(buildWebPortalAutoLoginUrl(authUser?.email || '', authPassword || ''))}
              className="settings-account-portal-btn account-portal-button"
            >
              <div className="account-portal-content">
                <span className="account-portal-label">Account Portal</span>
                <span className="account-portal-subtitle">(Auto Login)</span>
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
          <div className="auth-info-message auth-info-message-extra-margin">
            Email must be confirmed to receive bonus tokens.
          </div>

          <div className="setting-item">
            <label>Email</label>
            <input
              type="email"
              className="auth-input"
              ref={emailInputRef}
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
