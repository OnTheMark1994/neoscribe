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
