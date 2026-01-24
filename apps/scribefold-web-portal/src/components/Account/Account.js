import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import AuthForm from './AuthComponents/AuthForm';
import AccountDisplay from './AuthComponents/AccountDisplay';
import "./Account.css"

const Account = () => {
  const authUser = useSelector(state => state.userSlice.authUser);
  const [showAuthView, setShowAuthView] = useState(false); // Toggle for testing both views

  return (
    <>
      {/* Toggle button for testing - remove later */}
      <div style={{ marginBottom: '20px', padding: '10px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', border: '1px solid #fbbf24' }}>
        <button
          type="button"
          onClick={() => setShowAuthView(!showAuthView)}
          style={{
            padding: '8px 16px',
            background: '#fbbf24',
            color: '#022c22',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          {showAuthView ? 'Show Account Display' : 'Show Auth Login'}
        </button>
        <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: '#fbbf24' }}>
          (Testing toggle - remove later)
        </span>
      </div>

      {!authUser ? (
        <div className="sf-account-auth-wrapper">
          <header className="sf-page-header">
            <h1>Account</h1>
            <p>Sign in to view your ScribeFold AI account and usage stats.</p>
          </header>
          <AuthForm />
        </div>
      ) : (
        <AccountDisplay />
      )}
    </>
  );
};

export default Account;
