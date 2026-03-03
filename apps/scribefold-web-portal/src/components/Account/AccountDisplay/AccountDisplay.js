import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../../Global/SupabaseClient';
import RefreshUserData from '../../Util/RefreshUserData';
import ReferralSection from './ReferralSection';
import './AccountDisplay.css';
import TokensDisplay from './TokensDisplay';
import PlansDisplay from './PlansDisplay';
import { OneTimePacksDisplay } from './OneTImePacksDisplay';

const AccountDisplay = () => {
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData);
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);

  // Get current plan from user's tier_id
  const { PLANS } = require('../../../Global/constants');
  const currentPlan = PLANS.find(p => p.tier_id === Number(userData?.tier_id));

  // Check for token on mount
  useEffect(() => {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(hash.split('?')[1] || '');
    const token = urlParams.get('token');

    if (token) {
      handleTokenLogin(token);
    }
  }, []);

  const handleTokenLogin = async (token) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/token-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (data.success && data.session) {
        // Set Supabase session
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        });

        // Remove token from URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        console.error('Token login failed:', data.error);
      }
    } catch (error) {
      console.error('Error in token login:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      console.log("process.env.REACT_PROJECT_REF: ", process.env.REACT_APP_SUPABASE_PROJECT_REF)
      localStorage.removeItem(`sb-${process.env.REACT_APP_SUPABASE_PROJECT_REF}-auth-token`);
      // Clear Supabase auth token to prevent session issues
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleManageSubscription = async () => {
    if (!authUser) {
      console.error('[WEB] No auth user');
      return;
    }

    try {
      // Get current session from Supabase client
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('[WEB] No valid session:', sessionError);
        return;
      }

      const accessToken = session.access_token;

      const response = await fetch(`${process.env.REACT_APP_API_URL}/s/create-portal-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          authId: authUser.id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create portal session');
      }

      // Redirect to Stripe Customer Portal
      window.location.href = data.url;
    } catch (err) {
      console.error('[WEB] Portal session error:', err);
    }
  };

  return (
    <div className="sf-page sf-account-page">
      <div className="sf-account-inner">

        {/* Referrals */}
        <ReferralSection />


       
        <div className="sf-divider"></div>

        {/* Plans */}
        <PlansDisplay />

        <div className="sf-divider"></div>

        {/* Tokens Stats */}
        <TokensDisplay userData={userData} userDataLoading={userDataLoading}/>

        {/* One Time Packs */}
        {/* <OneTimePacksDisplay/> */}

        {/* <div className="sf-divider"></div> */}


        <div className="sf-divider"></div>

        {/* Account Details */}
        <section className="sf-account-summary">
          <div>
            <div className="sf-section-header">
              <h2>Account Details</h2>
              <RefreshUserData />
            </div>
            <div className="sf-account-detail-row">
              <span>Email</span>
              <span>{authUser?.email || 'Loading...'}</span>
            </div>
            <div className="sf-account-detail-row">
              <span>Current Plan</span>
              <span>
                {userDataLoading
                  ? 'Loading...'
                  : currentPlan?.name
                    ? `${currentPlan.name}`
                    : 'No active subscription'}
              </span>
            </div>
            <div className="sf-account-detail-row">
              <span>Next Billing Date</span>
              <span>
                {userDataLoading
                  ? 'Loading...'
                  : userData?.next_billing_date
                    ? new Date(userData.next_billing_date * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
              </span>
            </div>
          </div>
        </section>

        <div className="sf-divider"></div>

        {/* Account Actions */}
        <section className="sf-account-actions-section">
          <h2 className='sf-section-header'>Account Actions</h2>
          <div className="sf-account-actions-grid">
            <button type="button" className="sf-download-btn" onClick={handleManageSubscription}>
              Manage Subscription
            </button>
            <button type="button" className="sf-download-btn">
              Change Password
            </button>
            <button type="button" className="sf-download-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountDisplay;
