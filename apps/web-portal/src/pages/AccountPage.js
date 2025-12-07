import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { API_BASE_URL, STRIPE_CUSTOMER_PORTAL_URL } from '../constants';
import TokenUsageLog from '../components/TokenUsageLog';
import './AccountPage.css';

// Initial client-side plans: correct IDs/names but placeholder values so we never
// show stale numeric token counts while server config is loading.
const PLANS = [
  {
    id: 'light',
    name: 'Light',
    description: 'Loading...',
    monthlyPrice: 'Loading...',
    tokens: 'Loading...',
    stripe_payment_link: null
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Loading...',
    monthlyPrice: 'Loading...',
    tokens: 'Loading...',
    stripe_payment_link: null
  },
  {
    id: 'full',
    name: 'Full',
    description: 'Loading...',
    monthlyPrice: 'Loading...',
    tokens: 'Loading...',
    stripe_payment_link: null
  },
  {
    id: 'heavy',
    name: 'Heavy',
    description: 'Loading...',
    monthlyPrice: 'Loading...',
    tokens: 'Loading...',
    stripe_payment_link: null
  }
];
const ADDON_INCREMENTS = [
  500_000,
  1_000_000,
  1_500_000,
  2_000_000,
  2_500_000,
  3_000_000,
  3_500_000,
  4_000_000,
  4_500_000
];

const useQuery = () => {
  return new URLSearchParams(useLocation().search);
};

const AccountPage = () => {
  const { user, loading, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [isAutoLogin, setIsAutoLogin] = useState(false);
  const autoLoginAttemptedRef = useRef(false); // Rate limit: only attempt once per email per SPA session
  const lastAutoLoginEmailRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('basic');
  const [selectedAddonTokens, setSelectedAddonTokens] = useState(2_000_000);
  const [subscriptionStatusMsg, setSubscriptionStatusMsg] = useState('');
  const [addonStatusMsg, setAddonStatusMsg] = useState('');
  const [passwordStatusMsg, setPasswordStatusMsg] = useState('');
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [addonLoading, setAddonLoading] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState(null); // 'success' | 'cancel' | null
  const [showUsageInfo, setShowUsageInfo] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelStatusMsg, setCancelStatusMsg] = useState('');

  const navigate = useNavigate();
  const query = useQuery();

  // API base URL from constants
  const SERVER_URL = API_BASE_URL;

  const [plans, setPlans] = useState(PLANS);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) || plans[1] || PLANS[1];
  const selectedPrice = Number(selectedPlan?.monthlyPrice);
  const selectedTokens = Number(selectedPlan?.tokens);
  const unitPrice =
    Number.isFinite(selectedPrice) && Number.isFinite(selectedTokens) && selectedTokens > 0
      ? selectedPrice / selectedTokens
      : 0;
  const discountedUnitPrice = unitPrice * 0.75;

  const formatTokens = (value) => {
    if (!Number.isFinite(value)) return 'n/a';
    return value.toLocaleString();
  };

  const formatCurrency = (value) => {
    if (!Number.isFinite(value)) return 'n/a';
    return `$${value.toFixed(2)}`;
  };

  const getPlanNameByTierId = (tierId) => {
    if (tierId == null) return 'None';

    const numericId = Number(tierId);
    if (!Number.isFinite(numericId)) return `Tier ${tierId}`;

    const match = Array.isArray(plans)
      ? plans.find((plan) => plan.tier_id != null && Number(plan.tier_id) === numericId)
      : null;

    if (match && match.name) return match.name;

    return `Tier ${numericId}`;
  };

  // Auto-login route: /auto-login?email=...&password=...
  // Handles:
  // - Prefilling email/password fields
  // - Showing "Signing you in..." message
  // - If logged-in user matches, redirect to account
  // - If different user logged in, log them out first, wait 500ms, then log in new user
  // - Rate limited to one attempt per page load
  useEffect(() => {
    const urlEmail = query.get('email');
    const urlPassword = query.get('password');
    
    // Check if this is an auto-login route
    const isAutoLoginRoute = window.location.hash.includes('/auto-login');
    
    if (!urlEmail || !urlPassword || !isAutoLoginRoute) return;
    
    // Prefill the form fields
    setEmail(urlEmail);
    setPassword(urlPassword);
    setIsAutoLogin(true);
    setStatus('Signing you in...');

    // If the email in the URL has changed since the last auto-login,
    // reset the rate-limit so each distinct email gets one attempt.
    if (lastAutoLoginEmailRef.current !== urlEmail) {
      autoLoginAttemptedRef.current = false;
      lastAutoLoginEmailRef.current = urlEmail;
    }

    // Don't proceed until loading is complete
    if (loading) return;

    // Rate limit: only attempt once per email per SPA session
    if (autoLoginAttemptedRef.current) return;
    autoLoginAttemptedRef.current = true;
    
    const performAutoLogin = async () => {
      try {
        // If user is already logged in
        if (user) {
          // Check if the logged-in user matches the auto-login email
          if (user.email?.toLowerCase() === urlEmail.toLowerCase()) {
            // Same user, just redirect to account page
            setStatus('');
            setIsAutoLogin(false);
            navigate('/account', { replace: true });
            return;
          }
          
          // Different user is logged in - log them out first
          setStatus('Switching accounts...');
          await signOut();
          
          // Wait 500ms before logging in the new user
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Log in the new user
        setStatus('Signing you in...');
        await signInWithEmail(urlEmail, urlPassword);
        setStatus('');
        setIsAutoLogin(false);
        navigate('/account', { replace: true });
      } catch (err) {
        // Handle various error formats from Supabase
        const errorMessage = err?.message || err?.error_description || err?.error || 'Auto sign-in failed';
        console.error('[WEB] Auto-login error:', err);
        setStatus(errorMessage);
        setIsAutoLogin(false);
      }
    };
    
    performAutoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user, loading]);

  // Load subscription tiers from server so the portal stays in sync with server-side JSON
  useEffect(() => {
    const loadPlans = async () => {
      try {
        const url = `${SERVER_URL}/api/subscription-tiers`;

        // eslint-disable-next-line no-console
        console.log('[WEB] Fetching subscription tiers from:', url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Subscription tiers endpoint error: ${response.status}`);
        }

        const data = await response.json();
        // data is expected to be an object keyed by id (light/basic/full),
        // with each tier including a numeric tier_id we can use for matching.
        const mapped = Object.entries(data || {}).map(([id, tier]) => ({
          id,
          tier_id: tier.tier_id ?? tier.tierId ?? null,
          name: tier.title || id,
          description: tier.description || '',
          monthlyPrice: tier.monthly_price,
          tokens: tier.monthly_allowance,
          stripe_payment_link: tier.stripe_payment_link || null,
        }));

        if (mapped.length > 0) {
          setPlans(mapped);
        } else {
          setPlans(PLANS);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[WEB] Failed to load subscription tiers from server, using defaults:', err);
        setPlans(PLANS);
      }
    };

    loadPlans();
  }, [SERVER_URL]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;
      setStatsLoading(true);
      try {
        // Load token stats from backend server using auth_id as authId
        const url = `${SERVER_URL}/api/user/tokens/`;
        const body = {
          userId: null,
          authId: user.id,
        };

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`User tokens endpoint error: ${response.status}`);
        }

        const data = await response.json();

        setStats(data || null);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[WEB] Failed to load account stats:', err);
        setStats(null);
      } finally {
        setStatsLoading(false);
      }
    };

    loadStats();
  }, [user]);

  useEffect(() => {
    if (stats && stats.tier_id != null && Array.isArray(plans) && plans.length) {
      const match = plans.find(
        (plan) =>
          plan.tier_id != null &&
          Number(plan.tier_id) === Number(stats.tier_id),
      );
      if (match) {
        setSelectedPlanId(match.id);
      }
    }
  }, [stats, plans]);

  // Handle checkout return from Stripe
  useEffect(() => {
    const checkoutParam = query.get('checkout');
    if (checkoutParam === 'success') {
      setCheckoutStatus('success');
      setSubscriptionStatusMsg('Payment successful! Click "Sync Stripe" to activate your subscription.');
      // Clear the URL params
      navigate('/account', { replace: true });
    } else if (checkoutParam === 'cancel') {
      setCheckoutStatus('cancel');
      setSubscriptionStatusMsg('Checkout was cancelled. You can try again when ready.');
      navigate('/account', { replace: true });
    }
  }, [query, navigate]);

  // Detect if returning from Stripe checkout
  const urlParams = new URLSearchParams(window.location.search);
  const isCheckoutSuccess = urlParams.get('checkout') === 'success';

  // NOTE: We intentionally do NOT auto-call the Stripe sync API here.
  // Webhooks should be the primary source of truth.
  // If a webhook fails, an admin/developer can trigger a manual sync explicitly.

  // Previously we auto-synced after checkout success and with a force_refresh URL param.
  // That behavior has been removed to avoid unintentionally refilling tokens.

  // Manual refresh function
  const handleRefreshStats = async () => {
    if (!user) return;
    
    setStatsLoading(true);
    
    try {
      const response = await fetch(`${SERVER_URL}/api/user/tokens/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: null, authId: user.id }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data || null);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[WEB] Refresh error:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Sync subscription from Stripe - ADMIN/DEV ONLY.
  // Use this ONLY when webhooks failed and an admin needs to manually reconcile
  // subscription status for a user (e.g. support ticket or local testing).
  const handleSyncStripe = async () => {
    if (!user) return;
    
    setStatsLoading(true);
    setSubscriptionStatusMsg('Syncing with Stripe...');
    
    try {
      // eslint-disable-next-line no-console
      console.log('[WEB] Syncing subscription from Stripe for user:', user.email);
      
      const response = await fetch(`${SERVER_URL}/api/stripe/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: user.id, email: user.email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create customer portal session');
      }

      // eslint-disable-next-line no-console
      console.log('[WEB] Stripe sync response:', data);
      
      if (response.ok && data.synced) {
        const planName = getPlanNameByTierId(data.subscriptionType);
        setSubscriptionStatusMsg(`Synced! Subscription: ${planName}`);
        // Reload stats to get updated data
        const statsResponse = await fetch(`${SERVER_URL}/api/user/tokens/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: null, authId: user.id }),
        });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData || null);
        }
      } else {
        setSubscriptionStatusMsg(data.message || data.error || 'Sync failed');
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[WEB] Stripe sync error:', err);
      setSubscriptionStatusMsg(`Sync error: ${err.message}`);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
      if (authMode === 'login') {
        await signInWithEmail(email, password);
        setStatus('');
      } else {
        await signUpWithEmail(email, password);
        setStatus('Check your email to confirm your account.');
      }
    } catch (err) {
      setStatus(err.message || (authMode === 'login' ? 'Sign-in failed' : 'Sign-up failed'));
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setStatus('Enter your email above to reset your password.');
      return;
    }
    try {
      setStatus('Sending password reset email...');
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/account',
      });
      setStatus('If an account exists for that email, a reset link has been sent.');
    } catch (err) {
      setStatus(err.message || 'Failed to send password reset email');
    }
  };

  const handleNeedHelp = () => {
    navigate('/help');
  };

  // Handle Stripe checkout for subscriptions using Payment Links
  const handleSubscribeWithStripe = async () => {
    if (!user) return;

    const selectedPlanData = plans.find((plan) => plan.id === selectedPlanId);
    if (!selectedPlanData) {
      setSubscriptionStatusMsg('Plan not found');
      return;
    }

    // Check if payment link is configured
    if (!selectedPlanData.stripe_payment_link) {
      setSubscriptionStatusMsg('Payment link not configured for this plan. Please try again later.');
      return;
    }

    setSubscriptionLoading(true);
    setSubscriptionStatusMsg('Redirecting to checkout...');

    try {
      // Build the payment link URL with customer email prefilled
      let paymentUrl = selectedPlanData.stripe_payment_link;
      
      // Add prefilled_email parameter if user has email (Stripe Payment Links support this)
      if (user.email) {
        const separator = paymentUrl.includes('?') ? '&' : '?';
        paymentUrl = `${paymentUrl}${separator}prefilled_email=${encodeURIComponent(user.email)}`;
      }

      // Add client_reference_id to track which user made the purchase
      const separator = paymentUrl.includes('?') ? '&' : '?';
      paymentUrl = `${paymentUrl}${separator}client_reference_id=${encodeURIComponent(user.id)}`;

      // Redirect to Stripe Payment Link
      window.location.href = paymentUrl;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[WEB] Checkout error:', err);
      setSubscriptionStatusMsg(`Failed to redirect to checkout: ${err.message}`);
      setSubscriptionLoading(false);
    }
  };

  // Handle managing subscription via Stripe Customer Portal
  const handleManageSubscription = async () => {
    if (!user) return;

    try {
      setSubscriptionLoading(true);
      setSubscriptionStatusMsg('Opening subscription management...');

      // Open the Stripe-hosted customer portal in a new tab
      window.open(STRIPE_CUSTOMER_PORTAL_URL, '_blank', 'noopener,noreferrer');

      // We don't strictly need loading state once the tab is opened
      setSubscriptionLoading(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Customer portal error:', err);
      setSubscriptionStatusMsg(`Failed to open subscription management: ${err.message}`);
      setSubscriptionLoading(false);
    }
  };

  // Handle canceling all subscriptions directly via API (bypasses Stripe portal)
  const handleCancelAllSubscriptions = async () => {
    if (!user) return;

    // Confirm with user before proceeding
    const confirmed = window.confirm(
      'Are you sure you want to cancel ALL your subscriptions?\n\n' +
      'This will immediately cancel any active subscriptions associated with your email address. ' +
      'This action cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setCancelLoading(true);
      setCancelStatusMsg('Canceling subscriptions...');

      const response = await fetch(`${SERVER_URL}/api/stripe/cancel-all-subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to cancel subscriptions');
      }

      setCancelStatusMsg(`✓ ${data.message}`);

      // Refresh stats to reflect the cancellation
      handleRefreshStats();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Cancel subscriptions error:', err);
      setCancelStatusMsg(`✗ ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  };

  // Legacy direct subscription update (for testing/development without Stripe)
  const handleSubscribe = async () => {
    if (!user) return;
    try {
      setSubscriptionLoading(true);
      setSubscriptionStatusMsg('Processing...');

      const url = `${SERVER_URL}/api/user/subscription`;
      const body = {
        authId: user.id,
        subscriptionType: selectedPlanId,
      };

      // eslint-disable-next-line no-console
      console.log('[WEB] Updating subscription via:', url, 'body:', body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Subscription endpoint error: ${response.status}`);
      }

      const data = await response.json();
      // eslint-disable-next-line no-console
      console.log('[WEB] Subscription updated, new token data:', data);

      setStats(data || null);
      setSubscriptionStatusMsg(`Subscription updated to ${selectedPlan.name}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to update subscription:', err);
      setSubscriptionStatusMsg('Failed to update subscription.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const handleAddTokens = async () => {
    if (!user) return;
    try {
      setAddonLoading(true);
      setAddonStatusMsg('Processing...');

      const url = `${SERVER_URL}/api/user/add-tokens`;
      const body = {
        authId: user.id,
        tokensToAdd: selectedAddonTokens,
      };

      // eslint-disable-next-line no-console
      console.log('[WEB] Adding tokens via:', url, 'body:', body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Add-tokens endpoint error: ${response.status}`);
      }

      const data = await response.json();
      // eslint-disable-next-line no-console
      console.log('[WEB] Tokens added, new token data:', data);

      setStats(data || null);
      setAddonStatusMsg(`${formatTokens(selectedAddonTokens)} tokens added!`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to add tokens:', err);
      setAddonStatusMsg('Failed to add tokens.');
    } finally {
      setAddonLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      setStatus(err.message || 'Logout failed');
    }
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) {
      setPasswordStatusMsg('No email available for password reset.');
      return;
    }

    try {
      setPasswordStatusMsg('Sending password reset email...');
      const { error } = await supabase.auth.resetPasswordForEmail(user.email);
      if (error) {
        setPasswordStatusMsg(error.message || 'Failed to send password reset email.');
      } else {
        setPasswordStatusMsg('Password reset email sent. Please check your inbox.');
      }
    } catch (err) {
      setPasswordStatusMsg(err.message || 'Failed to send password reset email.');
    }
  };

  if (loading) {
    return (
      <div className="sf-page">
        <p>Loading accounthellip;</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="sf-page sf-account-page">
        <div className="sf-account-auth-wrapper">
          <header className="sf-page-header">
            <h1>Account</h1>
            <p>Sign in to view your ScribeFold AI account and usage stats.</p>
          </header>

          <form className="sf-auth-form" onSubmit={handleAuthSubmit}>
          <div className="sf-form-row">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isAutoLogin}
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
              disabled={isAutoLogin}
            />
          </div>
          {status && <div className="sf-status-message">{status}</div>}
          <div className="sf-auth-actions">
            <button type="submit" className="sf-primary-btn" disabled={isAutoLogin}>
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
        </div>
      </div>
    );
  }

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
            <button 
              type="button" 
              className={`sf-refresh-btn-icon ${statsLoading ? 'sf-spinning' : ''}`}
              onClick={handleRefreshStats}
              disabled={statsLoading}
              title="Refresh account details from ScribeFold database"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 21h5v-5"/>
              </svg>
            </button>
          </div>
          <div className="sf-account-detail-row">
            <span>Email</span>
            <span>{user.email}</span>
          </div>
          <div className="sf-account-detail-row">
            <span>User ID</span>
            <span>{user.id}</span>
          </div>
          <div className="sf-account-detail-row">
            <span>Current Plan</span>
            <span>
              {!stats
                ? 'Loading...'
                : stats.subscription_tier_name
                  ? `${stats.subscription_tier_name} (${stats.subscription_status || 'active'})`
                  : 'No active subscription'}
            </span>
          </div>
          {stats && stats.stripe_subscription_id && (
            <div className="sf-account-detail-row">
              <span>Subscription ID</span>
              <span style={{ fontSize: '0.8em', opacity: 0.7 }}>{stats.stripe_subscription_id}</span>
            </div>
          )}
          <div className="sf-account-detail-row">
            <span>Next Billing Date</span>
            <span>
              {!stats
                ? 'Loading...'
                : stats.next_billing_date
                  ? new Date(stats.next_billing_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'N/A'}
            </span>
          </div>
        </div>
        </section>
        )}
        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            margin: '24px 0',
          }}
        />

        {/* Keep the one-time purchases / subscription management UI in this file for later.
            We are temporarily hiding it in the portal until the Stripe flows are finalized. */}
        {false && (
        <section className="sf-account-plans">
        <div className="sf-section-header">
          <h2>One-time Purchases</h2>
          <button 
            type="button" 
            className={`sf-refresh-btn-icon ${statsLoading ? 'sf-spinning' : ''}`}
            onClick={handleRefreshStats}
            disabled={statsLoading}
            title="Refresh usage stats"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
          </button>
          <button
            type="button"
            className="sf-info-btn-icon"
            onClick={() => setShowUsageInfo((prev) => !prev)}
            title="What do these numbers mean?"
          >
            <span style={{ fontSize: '16px', fontWeight: 600 }}>i</span>
          </button>
        </div>
        {showUsageInfo && (
          <div className="sf-usage-info-panel">
            <p><strong>Available Tokens</strong> = Monthly Tokens + Added Tokens you still have left to use.</p>
            <p><strong>Monthly Tokens Remaining</strong> are your current monthly allowance from your subscription plan. They refill on your billing date and decrease first as you use AI.</p>
            <p><strong>Added Tokens Remaining</strong> are extra, long-lived tokens (bonuses or one-time packs). They are only used after Monthly Tokens reach zero and never reset each month.</p>
            <p><strong>Tokens Used This Month</strong> is how many tokens you have spent in the current billing period. This counter resets when your subscription renews.</p>
            <p><strong>Tokens Used All Time</strong> is your lifetime total tokens used and never resets.</p>
            <p><strong>Tokens Added Monthly</strong> shows how many Monthly Tokens will be topped up on your next billing date based on your current plan.</p>
          </div>
        )}
        <div className="sf-stats-grid">
          {/* Row 1: Available + Used This Month */}
          <div className="sf-stat-card">
            <span className="sf-stat-label">Available Tokens</span>
            <span className="sf-stat-value">
              {!stats
                ? 'Loading...'
                : (() => {
                    // Prefer backend's availableTokens from /api/user/tokens when present
                    if (typeof stats.availableTokens === 'number') {
                      return stats.availableTokens.toLocaleString();
                    }

                    // New formula: available = tokens_monthly + tokens_added
                    const tokensMonthly = stats.tokensMonthly ?? stats.tokens_monthly ?? 0;
                    const tokensAdded = stats.tokensAdded ?? stats.tokens_added ?? 0;
                    const remaining = Math.max(0, tokensMonthly + tokensAdded);
                    return Number.isFinite(remaining) ? remaining.toLocaleString() : 'n/a';
                  })()}
            </span>
          </div>
          <div className="sf-stat-card">
            <span className="sf-stat-label">Tokens Used This Month</span>
            <span className="sf-stat-value">
              {!stats
                ? 'Loading...'
                : (() => {
                    const used = stats.tokensUsed ?? stats.tokens_used;
                    return used != null ? Number(used).toLocaleString() : 'n/a';
                  })()}
            </span>
          </div>

          {/* Row 2: Monthly Tokens + Added Tokens */}
          <div className="sf-stat-card">
            <span className="sf-stat-label">Monthly Tokens Remaining</span>
            <span className="sf-stat-value">
              {!stats
                ? 'Loading...'
                : (() => {
                    const tokensMonthly = stats.tokensMonthly ?? stats.tokens_monthly;
                    return tokensMonthly != null ? Number(tokensMonthly).toLocaleString() : 'n/a';
                  })()}
            </span>
          </div>
          <div className="sf-stat-card">
            <span className="sf-stat-label">Added Tokens Remaining</span>
            <span className="sf-stat-value">
              {!stats
                ? 'Loading...'
                : (() => {
                    const tokensAdded = stats.tokensAdded ?? stats.tokens_added;
                    return tokensAdded != null ? Number(tokensAdded).toLocaleString() : 'n/a';
                  })()}
            </span>
          </div>

          {/* Row 3: Used All Time + Tokens Added Monthly (with next billing date note) */}
          <div className="sf-stat-card">
            <span className="sf-stat-label">Tokens Used All Time</span>
            <span className="sf-stat-value">
              {!stats
                ? 'Loading...'
                : (() => {
                    const allTime = stats.tokensUsedAllTime ?? stats.tokens_used_all_time;
                    return allTime != null ? Number(allTime).toLocaleString() : 'n/a';
                  })()}
            </span>
          </div>
          <div className="sf-stat-card">
            <span className="sf-stat-label">Tokens Added Monthly</span>
            <span className="sf-stat-value">
              {!stats
                ? 'Loading...'
                : (() => {
                    const tokensMonthly = stats.tokensMonthly ?? stats.tokens_monthly;
                    return tokensMonthly != null ? Number(tokensMonthly).toLocaleString() : 'n/a';
                  })()}
            </span>
            {stats && stats.next_billing_date && (
              <div style={{ fontSize: '0.8em', opacity: 0.8, marginTop: '4px' }}>
                On {new Date(stats.next_billing_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            )}
          </div>
        </div>
        <TokenUsageLog authId={user.id} />
        </section>

        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            margin: '24px 0',
          }}
        />

        <section className="sf-plans-section">
        <div className="sf-plans-header">
          <div className="sf-section-header">
            <h2>Choose A Plan</h2>
            <button 
              type="button" 
              className={`sf-refresh-btn-icon ${statsLoading ? 'sf-spinning' : ''}`}
              onClick={handleSyncStripe}
              disabled={statsLoading}
              title="Admin/Dev: Manually sync subscription from Stripe only if webhooks failed"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 21h5v-5"/>
              </svg>
            </button>
          </div>
          <p>Choose a monthly plan that fits your writing and editing volume.</p>
        </div>
        <div className="sf-plans-grid">
          {plans.map((plan) => {
            const numericTokens = Number(plan.tokens);
            const numericPrice = Number(plan.monthlyPrice);
            const hasNumericTokens = Number.isFinite(numericTokens);
            const hasNumericPrice = Number.isFinite(numericPrice);
            const pricePerThousand =
              hasNumericTokens && hasNumericPrice && numericTokens > 0
                ? numericPrice / (numericTokens / 1000)
                : null;
            const isSelected = plan.id === selectedPlanId;
            const isCurrentPlan =
              stats &&
              stats.tier_id != null &&
              plan.tier_id != null &&
              Number(plan.tier_id) === Number(stats.tier_id);
            return (
              <button
                key={plan.id}
                type="button"
                className={
                  'sf-plan-card' + (isSelected ? ' sf-plan-card-selected' : '')
                }
                onClick={() => setSelectedPlanId(plan.id)}
              >
                {isCurrentPlan && (
                  <div className="sf-plan-current-badge">
                    <span>Your</span>
                    <span>Plan</span>
                  </div>
                )}
                <div className="sf-plan-header-row">
                  <span
                    className="sf-plan-name"
                  >
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
                    {hasNumericPrice ? `${formatCurrency(numericPrice)}/mo` : 'Loading...'}
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
          {subscriptionStatusMsg && (
            <div className={`sf-plans-status-message ${checkoutStatus === 'success' ? 'sf-status-success' : checkoutStatus === 'cancel' ? 'sf-status-cancel' : ''}`}>
              {subscriptionStatusMsg}
            </div>
          )}
          <div className="sf-plans-buttons">
            <button
              type="button"
              className="sf-primary-btn sf-plans-subscribe-btn"
              disabled={(
                stats &&
                stats.tier_id != null &&
                selectedPlan &&
                selectedPlan.tier_id != null &&
                Number(selectedPlan.tier_id) === Number(stats.tier_id)
              ) || subscriptionLoading}
              onClick={handleSubscribeWithStripe}
            >
              {subscriptionLoading
                ? 'Processing...'
                : stats &&
                    stats.tier_id != null &&
                    selectedPlan &&
                    selectedPlan.tier_id != null &&
                    Number(selectedPlan.tier_id) === Number(stats.tier_id)
                  ? `You are currently subscribed to ${selectedPlan.name}`
                  : `Subscribe to ${selectedPlan.name}`}
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
            {formatCurrency(discountedUnitPrice * selectedAddonTokens)} one-time
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
            const price = discountedUnitPrice * tokens;
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
          {addonStatusMsg && (
            <div className="sf-plans-status-message">{addonStatusMsg}</div>
          )}
          <button
            type="button"
            className="sf-primary-btn sf-plans-subscribe-btn"
            onClick={handleAddTokens}
            disabled={addonLoading}
          >
            Add {formatTokens(selectedAddonTokens)} tokens
          </button>
        </div>
      </section>

      <div
        style={{
          borderTop: '1px solid var(--sf-border-color, #333)',
          margin: '24px 0',
        }}
      />

      <section className="sf-account-actions-section">
        <h2>Account actions</h2>
        <div className="sf-account-actions-grid">
          {stats && stats.stripe_subscription_id && (
            <button 
              className="sf-secondary-btn sf-secondary-btn-neutral" 
              type="button"
              onClick={handleManageSubscription}
              disabled={subscriptionLoading}
            >
              Manage Subscription
            </button>
          )}
          <button className="sf-secondary-btn sf-secondary-btn-neutral" type="button" onClick={handleChangePassword}>
            Change Password
          </button>
          <button className="sf-secondary-btn sf-secondary-btn-neutral" onClick={handleLogout}>
            Log Out
          </button>
        </div>
        <div
          style={{
            borderTop: '1px solid var(--sf-border-color, #333)',
            marginTop: '24px',
            paddingTop: '16px',
          }}
        />
        {passwordStatusMsg && (
          <div
            className="sf-status-message"
            style={{ marginTop: '8px', textAlign: 'center' }}
          >
            {passwordStatusMsg}
          </div>
        )}
      </section>
      </div>
    </div>
  );
};

export default AccountPage;
