import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { supabase } from '../../../Global/SupabaseClient';
import RefreshUserData from '../../Util/RefreshUserData';
import './AccountDisplay.css';

const AccountDisplay = () => {
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData);
  const [selectedAddonTokens, setSelectedAddonTokens] = useState(2_000_000);
  const dispatch = useDispatch();

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

  const formatTokens = (value) => {
    if (!Number.isFinite(value)) return 'n/a';
    return value.toLocaleString();
  };

  const formatCurrency = (value) => {
    if (!Number.isFinite(value)) return 'n/a';
    return `$${value.toFixed(2)}`;
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

  const handleGetMoreTokens = async () => {
    try {
      if (!authUser?.id) {
        console.error('Cannot generate token - no user ID');
        return;
      }

      // Call API to generate login token
      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/generate-login-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id })
      });

      const data = await response.json();

      if (!data.success || !data.loginToken) {
        console.error('Failed to generate login token:', data.error);
        return;
      }

      // Redirect to editor with token in URL
      const editorUrl = `${window.location.origin}/#/editor?token=${encodeURIComponent(data.loginToken)}`;
      window.location.href = editorUrl;

    } catch (error) {
      console.error('Error in handleGetMoreTokens:', error);
    }
  };

  return (
    <div className="sf-page sf-account-page">
      <div className="sf-account-inner">
        <header className="sf-page-header">
          <h1>Your Account</h1>
          <p>View your ScribeFold AI usage and manage your account.</p>
        </header>

        <section className="sf-account-summary">
          <div>
            <div className="sf-section-header">
              <h2>Account details</h2>
              <RefreshUserData />
            </div>
            <div className="sf-account-detail-row">
              <span>Email</span>
              <span>{authUser?.email || 'Loading...'}</span>
            </div>
            <div className="sf-account-detail-row">
              <span>User ID</span>
              <span>{authUser?.id || 'Loading...'}</span>
            </div>
            <div className="sf-account-detail-row">
              <span>Current Plan</span>
              <span>
                {!userData
                  ? 'Loading...'
                  : userData.subscription_tier_name
                    ? `${userData.subscription_tier_name} (${userData.subscription_status || 'active'})`
                    : 'No active subscription'}
              </span>
            </div>
            {userData?.stripe_subscription_id && (
              <div className="sf-account-detail-row">
                <span>Subscription ID</span>
                <span style={{ fontSize: '0.8em', opacity: 0.7 }}>{userData.stripe_subscription_id}</span>
              </div>
            )}
            <div className="sf-account-detail-row">
              <span>Next Billing Date</span>
              <span>
                {!userData
                  ? 'Loading...'
                  : userData.next_billing_date
                    ? new Date(userData.next_billing_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
              </span>
            </div>
          </div>
        </section>

        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            margin: '24px 0',
          }}
        />

        <section className="sf-account-stats">
          <div className="sf-section-header">
            <h2>Token Usage</h2>
            <RefreshUserData />
          </div>
          <div className="sf-stats-grid">
            <div className="sf-stat-card">
              <span className="sf-stat-label">Available Tokens</span>
              <span className="sf-stat-value">
                {!userData
                  ? 'Loading...'
                  : formatTokens(userData.tokens || userData.tokens_monthly + userData.tokens_added)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Used This Month</span>
              <span className="sf-stat-value">
                {!userData
                  ? 'Loading...'
                  : formatTokens(userData.tokens_used_this_month)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Monthly Tokens Remaining</span>
              <span className="sf-stat-value">
                {!userData
                  ? 'Loading...'
                  : formatTokens(userData.tokens_monthly)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Added Tokens Remaining</span>
              <span className="sf-stat-value">
                {!userData
                  ? 'Loading...'
                  : formatTokens(userData.tokens_added)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Used All Time</span>
              <span className="sf-stat-value">
                {!userData
                  ? 'Loading...'
                  : formatTokens(userData.tokens_used_all_time)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Added Monthly</span>
              <span className="sf-stat-value">
                {!userData
                  ? 'Loading...'
                  : formatTokens(userData.tokens_monthly)}
              </span>
              {userData?.next_billing_date && (
                <div style={{ fontSize: '0.8em', opacity: 0.8, marginTop: '4px' }}>
                  On {new Date(userData.next_billing_date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            margin: '24px 0',
          }}
        />

        <section className="sf-plans-section">
          <div className="sf-plans-header">
            <h2>Choose A Plan</h2>
            <p>Choose a monthly plan that fits your writing and editing volume.</p>
          </div>
          <div className="sf-plans-grid">
            {[
              { id: 'light', name: 'Light', description: 'Perfect for casual writers', tokens: 500000, monthlyPrice: 5, tier_id: 1 },
              { id: 'basic', name: 'Basic', description: 'For regular writing projects', tokens: 2000000, monthlyPrice: 15, tier_id: 2 },
              { id: 'full', name: 'Full', description: 'For professional authors', tokens: 5000000, monthlyPrice: 30, tier_id: 3 },
              { id: 'heavy', name: 'Heavy', description: 'For power users', tokens: 10000000, monthlyPrice: 50, tier_id:4 },
            ].map((plan) => {
              const numericTokens = Number(plan.tokens);
              const numericPrice = Number(plan.monthlyPrice);
              const hasNumericTokens = Number.isFinite(numericTokens);
              const hasNumericPrice = Number.isFinite(numericPrice);
              const pricePerThousand =
                hasNumericTokens && hasNumericPrice && numericTokens > 0
                  ? numericPrice / (numericTokens / 1000)
                  : null;
              const isCurrentPlan =
                userData?.tier_id != null &&
                Number(plan.tier_id) === Number(userData.tier_id);
              return (
                <button
                  key={plan.id}
                  type="button"
                  className="sf-plan-card"
                >
                  {isCurrentPlan && (
                    <div className="sf-plan-current-badge">
                      <span>Your</span>
                      <span>Plan</span>
                    </div>
                  )}
                  <div className="sf-plan-header-row">
                    <span className="sf-plan-name">
                      {plan.name}
                    </span>
                  </div>
                  <div className="sf-plan-body">
                    <div className="sf-plan-tokens">
                      {hasNumericTokens
                        ? `${formatTokens(numericTokens)} tokens / month`
                        : 'Loading tokens...'}
                    </div>
                    <div className="sf-plan-price">
                      {hasNumericPrice ? `$${numericPrice}/mo` : 'Loading...'}
                    </div>
                    <div className="sf-plan-unit-price">
                      {pricePerThousand != null
                        ? `$${pricePerThousand.toFixed(3)} per 1k tokens`
                        : 'Loading...'}
                    </div>
                    <div className="sf-plan-description" style={{ textAlign: 'center' }}>
                      {plan.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="sf-plans-footer">
            <div className="sf-plans-buttons">
              <button type="button" className="sf-primary-btn sf-plans-subscribe-btn">
                {userData?.tier_id ? 'Change Plan' : 'Subscribe'}
              </button>
            </div>
          </div>
        </section>

        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            margin: '24px 0',
          }}
        />

        <section className="sf-account-actions-section">
          <h2>Account Actions</h2>
          <div className="sf-account-actions-grid">
            <button type="button" className="sf-secondary-btn">
              Manage Subscription
            </button>
            <button type="button" className="sf-secondary-btn">
              Change Password
            </button>
            <button type="button" className="sf-secondary-btn" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        </section>

        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            margin: '24px 0',
          }}
        />

        <section className="sf-addon-section">
          <div className="sf-addon-header">
            <h2>One-time token packs</h2>
            <p>
              Need an extra burst? Token packs use the same per-token pricing as your
              selected monthly plan. Tokens you buy here never expire, but you need an
              active subscription plan to use them.
            </p>
          </div>
          <div className="sf-addon-slider-row">
            <div className="sf-addon-slider-label">Pick size</div>
            <div className="sf-addon-slider-amount">
              {formatTokens(selectedAddonTokens)} tokens
            </div>
            <div className="sf-addon-slider-price">
              {formatCurrency(0.0075 * selectedAddonTokens)} one-time
            </div>
            <input
              type="range"
              min={500000}
              max={5000000}
              step={500000}
              value={selectedAddonTokens}
              onChange={(e) => setSelectedAddonTokens(Number(e.target.value))}
            />
          </div>
          <div className="sf-addon-grid">
            {[500000, 1000000, 1500000, 2000000, 2500000, 3000000, 3500000, 4000000, 5000000].map((tokens) => {
              const price = 0.0075 * tokens;
              const isSelected = tokens === selectedAddonTokens;
              return (
                <button
                  key={tokens}
                  type="button"
                  className={
                    'sf-addon-card' + (isSelected ? ' sf-addon-card-selected' : '')
                  }
                  onClick={() => setSelectedAddonTokens(tokens)}
                >
                  <div className="sf-addon-tokens">{formatTokens(tokens)} tokens</div>
                  <div className="sf-addon-price">{formatCurrency(price)}</div>
                </button>
              );
            })}
          </div>
          <div className="sf-addon-footer">
            <button
              type="button"
              className="sf-primary-btn sf-plans-subscribe-btn"
              onClick={handleGetMoreTokens}
            >
              Get {formatTokens(selectedAddonTokens)} more tokens
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccountDisplay;
