import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { API_BASE_URL } from '../constants';
import './DeveloperPage.css';

/**
 * Developer-only page for testing token tracking system
 * Per TOKEN_TRACKING.md Section 7: Simulate Stripe webhook scenarios
 */
const DeveloperPage = () => {
  const { user } = useAuth();
  const [tierId, setTierId] = useState(2); // Default to Basic
  const [statusMessage, setStatusMessage] = useState('')
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [debugAuthId, setDebugAuthId] = useState('');
  const [debugUserId, setDebugUserId] = useState('');
  const [hasAutoFetched, setHasAutoFetched] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [tiers, setTiers] = useState([]);

  // Custom token values
  const [tokensMonthly, setTokensMonthly] = useState('');
  const [tokensAdded, setTokensAdded] = useState('');
  const [tokensUsed, setTokensUsed] = useState('');

  const SERVER_URL = API_BASE_URL;
  
  // Set default Auth ID from user on mount
  useEffect(() => {
    if (user && user.id && !debugAuthId) {
      console.log('[DEV] Setting default Auth ID from user', user.id);
      setDebugAuthId(user.id);
    }
  }, [user, debugAuthId]);

  // Auto-fetch user data once on mount if Auth ID is available
  useEffect(() => {
    if (!user || !debugAuthId || hasAutoFetched) return;

    console.log('[DEV] Auto-fetching user data on start with Auth ID', debugAuthId);
    setHasAutoFetched(true);
    handleLoadFromAuthId();
  }, [user, debugAuthId, hasAutoFetched]);

  // Load subscription tiers from server so this page stays in sync with server-side JSON
  useEffect(() => {
    const loadTiers = async () => {
      try {
        const url = `${SERVER_URL}/api/subscription-tiers`;
        // eslint-disable-next-line no-console
        console.log('[DEV] Fetching subscription tiers from:', url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Subscription tiers endpoint error: ${response.status}`);
        }

        const data = await response.json();
        const mapped = Object.entries(data || {}).map(([key, tier]) => ({
          id: tier.tier_id ?? tier.tierId ?? null,
          name: tier.title || key,
          allowance: tier.monthly_allowance ?? tier.token_limit ?? 0,
        })).filter(t => t.id != null);

        if (mapped.length > 0) {
          setTiers(mapped);
          // Default tierId to first mapped tier if current tierId is not valid
          if (!mapped.some(t => Number(t.id) === Number(tierId))) {
            setTierId(Number(mapped[0].id));
          }
        } else {
          setTiers([]);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[DEV] Failed to load subscription tiers from server:', err);
        setTiers([]);
      }
    };

    loadTiers();
  }, [SERVER_URL]);

  const handleSimulateCreated = async () => {
    if (!user) {
      setStatusMessage('You must be logged in to simulate webhooks');
      return;
    }

    setLoading(true);
    setStatusMessage('Simulating subscription created...');

    try {
      const response = await fetch(`${SERVER_URL}/api/dev/stripe/simulate-subscription-created`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: user.id, tierId: Number(tierId) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      setLastResult(data);
      setStatusMessage(`✓ Subscription created simulation successful! Tier: ${tierId}`);
    } catch (error) {
      setStatusMessage(`✗ Error: ${error.message}`);
      setLastResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshUserInfo = async () => {
    const targetId = debugUserId;

    if (!targetId) {
      setStatusMessage('Enter a user ID (from users.id) to load account info');
      return;
    }

    setLoading(true);
    setStatusMessage('Loading account info...');

    try {
      const response = await fetch(`${SERVER_URL}/api/dev/user-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: targetId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load account info');
      }

      setAccountInfo(data);
      setStatusMessage('✓ Loaded account info. See JSON below.');
    } catch (error) {
      setStatusMessage(`✗ Account info error: ${error.message}`);
      setAccountInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWithStripe = async () => {
    if (!user) {
      setStatusMessage('You must be logged in to sync with Stripe');
      return;
    }
    const targetId = user.id;

    setLoading(true);
    setStatusMessage('Syncing with Stripe (manual dev sync)...');

    try {
      const response = await fetch(`${SERVER_URL}/api/stripe/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: targetId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Stripe sync failed');
      }

      setLastResult(data);
      setStatusMessage('✓ Stripe sync completed. See detailed log below.');
    } catch (error) {
      setStatusMessage(`✗ Stripe sync error: ${error.message}`);
      setLastResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateRenewed = async () => {
    if (!user) {
      setStatusMessage('You must be logged in to simulate webhooks');
      return;
    }

    setLoading(true);
    setStatusMessage('Simulating subscription renewed...');

    try {
      const response = await fetch(`${SERVER_URL}/api/dev/stripe/simulate-subscription-renewed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: user.id, tierId: Number(tierId) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      setLastResult(data);
      setStatusMessage(`✓ Subscription renewed simulation successful! Tier: ${tierId}`);
    } catch (error) {
      setStatusMessage(`✗ Error: ${error.message}`);
      setLastResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateCanceled = async () => {
    if (!user) {
      setStatusMessage('You must be logged in to simulate webhooks');
      return;
    }

    setLoading(true);
    setStatusMessage('Simulating subscription canceled...');

    try {
      const response = await fetch(`${SERVER_URL}/api/dev/stripe/simulate-subscription-canceled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Simulation failed');
      }

      setLastResult(data);
      setStatusMessage('✓ Subscription canceled simulation successful!');
    } catch (error) {
      setStatusMessage(`✗ Error: ${error.message}`);
      setLastResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSetTokens = async () => {
    if (!user) {
      setStatusMessage('You must be logged in to set tokens');
      return;
    }

    setLoading(true);
    setStatusMessage('Setting tokens...');

    try {
      const body = { authId: user.id };
      if (tokensMonthly !== '') body.tokens_monthly = Number(tokensMonthly);
      if (tokensAdded !== '') body.tokens_added = Number(tokensAdded);
      if (tokensUsed !== '') body.tokens_used = Number(tokensUsed);

      const response = await fetch(`${SERVER_URL}/api/dev/set-tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Set tokens failed');
      }

      setLastResult(data);
      setStatusMessage('✓ Tokens set successfully!');
    } catch (error) {
      setStatusMessage(`✗ Error: ${error.message}`);
      setLastResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromAuthId = async () => {
    if (!debugAuthId) {
      setStatusMessage('Enter an Auth ID to load account info');
      return;
    }

    setLoading(true);
    setStatusMessage('Loading account info from Auth ID...');
    console.log('[DEV] Loading data from Auth ID', debugAuthId);

    try {
      const response = await fetch(`${SERVER_URL}/api/user/tokens/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: debugAuthId }),
      });

      console.log('[DEV] /api/user/tokens response status for Auth ID', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('[DEV] Non-OK response for Auth ID load', { status: response.status, body: text });
        throw new Error(`Failed to load data: ${response.status}`);
      }

      const data = await response.json();
      console.log('[DEV] Data loaded from Auth ID', data);

      setAccountInfo({ source: 'Auth ID', id: debugAuthId, data });
      setStatusMessage('✓ Loaded account info from Auth ID. See JSON below.');

      // If userId is in the response, set it as default for User ID input if empty
      if (data && data.userId && !debugUserId) {
        console.log('[DEV] Setting User ID from response', data.userId);
        setDebugUserId(String(data.userId));
      }
    } catch (error) {
      console.error('[DEV] Error loading from Auth ID', error);
      setStatusMessage(`✗ Error loading from Auth ID: ${error.message}`);
      setAccountInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFromUserId = async () => {
    if (!debugUserId) {
      setStatusMessage('Enter a User ID (from users.id) to load account info');
      return;
    }

    setLoading(true);
    setStatusMessage('Loading account info from User ID...');
    console.log('[DEV] Loading data from User ID', debugUserId);

    try {
      const response = await fetch(`${SERVER_URL}/api/dev/user-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: debugUserId }),
      });

      console.log('[DEV] /api/dev/user-info response status for User ID', response.status);

      if (!response.ok) {
        const text = await response.text();
        console.error('[DEV] Non-OK response for User ID load', { status: response.status, body: text });
        throw new Error(`Failed to load data: ${response.status}`);
      }

      const data = await response.json();
      console.log('[DEV] Data loaded from User ID', data);

      setAccountInfo({ source: 'User ID', id: debugUserId, data });
      setStatusMessage('✓ Loaded account info from User ID. See JSON below.');
    } catch (error) {
      console.error('[DEV] Error loading from User ID', error);
      setStatusMessage(`✗ Error loading from User ID: ${error.message}`);
      setAccountInfo(null);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="sf-page sf-developer-page">
        <div className="sf-developer-inner">
          <header className="sf-page-header">
            <h1>Developer Tools</h1>
            <p>You must be logged in to access developer tools.</p>
          </header>
        </div>
      </div>
    );
  }

  return (
    <div className="sf-page sf-developer-page">
      <div className="sf-developer-inner">
        <header className="sf-page-header">
          <h1>Developer Tools</h1>
          <p>Test the token tracking system by simulating Stripe webhook events.</p>
        </header>

        <section className="sf-dev-section">
          <h2>Account Info</h2>
          <p className="sf-dev-description">
            Inspect raw user row(s) by Auth ID (Supabase UUID) or database User ID (users.id). Defaults to the current user when possible.
          </p>

          <div className="sf-dev-account-controls">
            <div className="sf-dev-input-group">
              <label htmlFor="debug-auth-id">Auth ID:</label>
              <input
                id="debug-auth-id"
                type="text"
                value={debugAuthId}
                onChange={(e) => setDebugAuthId(e.target.value)}
                placeholder="Supabase auth UUID"
              />
              <button
                className="sf-dev-btn sf-dev-btn-renew"
                type="button"
                onClick={handleLoadFromAuthId}
                disabled={loading}
              >
                Load from Auth ID
              </button>
            </div>
            <div className="sf-dev-input-group">
              <label htmlFor="debug-user-id">User ID:</label>
              <input
                id="debug-user-id"
                type="text"
                value={debugUserId}
                onChange={(e) => setDebugUserId(e.target.value)}
                placeholder="Database users.id"
              />
              <button
                className="sf-dev-btn sf-dev-btn-renew"
                type="button"
                onClick={handleLoadFromUserId}
                disabled={loading}
              >
                Load from User ID
              </button>
            </div>
            <div className="sf-dev-buttons">
              <button
                className="sf-dev-btn sf-dev-btn-create"
                type="button"
                onClick={handleSyncWithStripe}
                disabled={loading}
              >
                Sync with Stripe (Manual)
              </button>
            </div>
          </div>

          {accountInfo && (
            <pre className="sf-dev-json">
              {JSON.stringify(accountInfo, null, 2)}
            </pre>
          )}
        </section>

        <section className="sf-dev-section">
          <h2>Simulate Stripe Webhooks</h2>
          <p className="sf-dev-description">
            These buttons simulate the same business logic that runs when Stripe webhooks fire.
            Use them to test subscription and token behavior without real Stripe events.
          </p>

          <div className="sf-dev-tier-select">
            <label htmlFor="tier-select">Select Tier:</label>
            <select
              id="tier-select"
              value={tierId}
              onChange={(e) => setTierId(Number(e.target.value))}
            >
              {tiers.length === 0 && (
                <option value={tierId}>Loading tiers...</option>
              )}
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name} (
                  {typeof tier.allowance === 'number'
                    ? tier.allowance.toLocaleString()
                    : 'n/a'}
                  {' '}tokens/month)
                </option>
              ))}
            </select>
          </div>

          <div className="sf-dev-buttons">
            <button
              className="sf-dev-btn sf-dev-btn-create"
              onClick={handleSimulateCreated}
              disabled={loading}
            >
              Simulate Subscription Created
            </button>
            <button
              className="sf-dev-btn sf-dev-btn-renew"
              onClick={handleSimulateRenewed}
              disabled={loading}
            >
              Simulate Subscription Renewed
            </button>
            <button
              className="sf-dev-btn sf-dev-btn-cancel"
              onClick={handleSimulateCanceled}
              disabled={loading}
            >
              Simulate Subscription Canceled
            </button>
          </div>
        </section>

        <section className="sf-dev-section">
          <h2>Set Tokens Directly</h2>
          <p className="sf-dev-description">
            Manually set token values for testing. Leave fields empty to keep current values.
          </p>

          <div className="sf-dev-token-inputs">
            <div className="sf-dev-input-group">
              <label htmlFor="tokens-monthly">tokens_monthly:</label>
              <input
                id="tokens-monthly"
                type="number"
                value={tokensMonthly}
                onChange={(e) => setTokensMonthly(e.target.value)}
                placeholder="Current monthly balance"
              />
            </div>
            <div className="sf-dev-input-group">
              <label htmlFor="tokens-added">tokens_added:</label>
              <input
                id="tokens-added"
                type="number"
                value={tokensAdded}
                onChange={(e) => setTokensAdded(e.target.value)}
                placeholder="Bonus/carry-over tokens"
              />
            </div>
            <div className="sf-dev-input-group">
              <label htmlFor="tokens-used">tokens_used:</label>
              <input
                id="tokens-used"
                type="number"
                value={tokensUsed}
                onChange={(e) => setTokensUsed(e.target.value)}
                placeholder="Usage counter this month"
              />
            </div>
          </div>

          <button
            className="sf-dev-btn sf-dev-btn-set"
            onClick={handleSetTokens}
            disabled={loading}
          >
            Set Tokens
          </button>
        </section>

        {statusMessage && (
          <div className={`sf-dev-status ${statusMessage.startsWith('✓') ? 'sf-dev-status-success' : statusMessage.startsWith('✗') ? 'sf-dev-status-error' : ''}`}>
            {statusMessage}
          </div>
        )}

        {lastResult && (
          <section className="sf-dev-section sf-dev-result">
            <h2>Last Result</h2>
            <pre className="sf-dev-json">
              {JSON.stringify(lastResult, null, 2)}
            </pre>
          </section>
        )}

        <section className="sf-dev-section sf-dev-info">
          <h2>Token Tracking Model Reference</h2>
          <div className="sf-dev-model-info">
            <h3>Fields</h3>
            <ul>
              <li><strong>tokens_monthly</strong>: Current monthly allowance BALANCE (decreases as used)</li>
              <li><strong>tokens_added</strong>: Long-lived carry-over bucket (bonuses, top-ups)</li>
              <li><strong>tokens_used</strong>: Tokens used in current billing period (counter, resets monthly)</li>
              <li><strong>tokens_used_all_time</strong>: Lifetime usage counter</li>
            </ul>

            <h3>Formula</h3>
            <p><code>availableTokens = tokens_monthly + tokens_added</code></p>

            <h3>Deduction Order</h3>
            <ol>
              <li>Deduct from <code>tokens_monthly</code> first</li>
              <li>Then deduct from <code>tokens_added</code></li>
              <li>Increment <code>tokens_used</code> and <code>tokens_used_all_time</code></li>
            </ol>

            <h3>Renewal Logic</h3>
            <p><code>tokens_monthly = max(tokens_monthly, tierLimit)</code></p>
            <p><code>tokens_used = 0</code></p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DeveloperPage;
