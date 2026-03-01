import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { supabase } from '../../../Global/SupabaseClient';
import RefreshUserData from '../../Util/RefreshUserData';
import './AccountDisplay.css';

// Plan definitions - may be moved to server later
const PLANS = [
  { id: 'light', name: 'Light', description: 'Good for occasional writing and small projects.', tokens: 1000000, monthlyPrice: 8.5, tier_id: 1, stripe_price_id: process.env.REACT_APP_STRIPE_PRICE_ID_LIGHT },
  { id: 'basic', name: 'Basic', description: 'Good for regular use and active editing sessions.', tokens: 2500000, monthlyPrice: 14.5, tier_id: 2, stripe_price_id: process.env.REACT_APP_STRIPE_PRICE_ID_BASIC },
  { id: 'full', name: 'Standard', description: 'Great for creating stories and books.', tokens: 8500000, monthlyPrice: 28.5, tier_id: 3, stripe_price_id: process.env.REACT_APP_STRIPE_PRICE_ID_FULL },
  { id: 'heavy', name: 'Heavy', description: 'Dare you to use them all.', tokens: 85000000, monthlyPrice: 89.5, tier_id: 4, stripe_price_id: process.env.REACT_APP_STRIPE_PRICE_ID_HEAVY },
];

const AccountDisplay = () => {
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData);
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);
  const [selectedAddonTokens, setSelectedAddonTokens] = useState(2_000_000);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionStatusMsg, setSubscriptionStatusMsg] = useState('');
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
    if (!Number.isFinite(value)) return '-';
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

  // Handle Stripe checkout for subscriptions using Checkout Sessions
  const handleSubscribeWithStripe = async () => {
    if (!authUser) return;

    const selectedPlanData = PLANS.find((plan) => plan.id === selectedPlanId);
    if (!selectedPlanData) {
      setSubscriptionStatusMsg('Plan not found');
      return;
    }

    setSubscriptionLoading(true);
    setSubscriptionStatusMsg('Creating checkout session...');

    try {
      // Call the server to create a checkout session
      const response = await fetch(`${process.env.REACT_APP_API_URL}/s/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authId: authUser.id,
          priceId: selectedPlanData.stripe_price_id
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[WEB] Checkout error:', err);
      setSubscriptionStatusMsg(`Failed to redirect to checkout: ${err.message}`);
      setSubscriptionLoading(false);
    }
  };

  return (
    <div className="sf-page sf-account-page">
      <div className="sf-account-inner">
        <section className="sf-plans-section">
          <div className="sf-plans-header" style={{ textAlign: 'center' }}>
            <h2>Choose a Plan</h2>
          </div>
          <div className="sf-plans-grid">
            {PLANS.map((plan) => {
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
              const isSelected = selectedPlanId === plan.id;
              return (
                <button
                  key={plan.id}
                  type="button"
                  className={`sf-plan-card ${isSelected ? 'sf-plan-card-selected' : ''}`}
                  onClick={() => setSelectedPlanId(plan.id)}
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
              <button 
                type="button" 
                className={`sf-primary-btn sf-plans-subscribe-btn ${(() => {
                  const currentTierId = userData?.tier_id;
                  const selectedPlan = PLANS.find(p => p.id === selectedPlanId);
                  const selectedTierId = selectedPlan?.tier_id;
                  return (selectedPlanId && (!currentTierId || selectedTierId > currentTierId)) ? 'sf-plans-subscribe-btn-glow' : '';
                })()}`}
                onClick={handleSubscribeWithStripe}
                disabled={!selectedPlanId || subscriptionLoading}
              >
                {subscriptionLoading ? 'Processing...' : (userData?.tier_id ? 'Change Plan' : 'Subscribe')}
              </button>
              {subscriptionStatusMsg && (
                <div style={{ marginTop: '8px', fontSize: '0.9em', opacity: 0.8 }}>
                  {subscriptionStatusMsg}
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

        <section className="sf-account-stats">
          <div className="sf-section-header">
            <h2>Token Usage</h2>
            <RefreshUserData />
          </div>
          <div className="sf-stats-grid">
            <div className="sf-stat-card">
              <span className="sf-stat-label">Available Tokens</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData.tokens || userData.tokens_monthly + userData.tokens_added)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Used This Month</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData.tokens_used_this_month)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Monthly Tokens Remaining</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData.tokens_monthly)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Added Tokens Remaining</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData.tokens_added)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Used All Time</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData.tokens_used_all_time)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Added Monthly</span>
              <span className="sf-stat-value">
                {userDataLoading
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

        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            margin: '24px 0',
          }}
        />

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
                {userDataLoading
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
                {userDataLoading
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

        <section className="sf-account-actions-section">
          <h2>Account Actions</h2>
          <div className="sf-account-actions-grid">
            <button type="button" className="sf-download-btn">
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
