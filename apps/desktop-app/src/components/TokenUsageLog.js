import React, { useState } from 'react';
import './TokenUsageLog.css';
import { API_BASE_URL } from '../utils/constants';
import RefreshButton from './RefreshButton';

// Number of token_log entries to fetch per page (initial load and each "Load More" click)
const TOKEN_LOG_PAGE_SIZE = 4;

/**
 * TokenUsageLog - A foldable panel that displays token_log entries for the current user.
 * Fetches data via the API server endpoint.
 */
function TokenUsageLog({ anonId, authId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [onlyAdditions, setOnlyAdditions] = useState(false);

  const toggleOpen = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    // Load data on first open
    if (nextOpen && logs.length === 0 && !loading) {
      await loadLogs(true);
    }
  };

  const loadLogs = async (replace = false) => {
    if (!anonId && !authId) {
      setError('No user ID available');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentOffset = replace ? 0 : logs.length;

      const response = await fetch(`${API_BASE_URL}/api/user/token-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anonId: anonId || null,
          authId: authId || null,
          limit: TOKEN_LOG_PAGE_SIZE,
          offset: currentOffset,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error: ${response.status} ${text}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const newLogs = Array.isArray(data.logs) ? data.logs : [];
      setHasMore(!!data.hasMore);

      if (replace) {
        setLogs(newLogs);
      } else {
        setLogs((prev) => [...prev, ...newLogs]);
      }
    } catch (err) {
      console.error('[TokenUsageLog] Error:', err);
      setError(err.message || 'Failed to load token log');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadLogs(false);
    }
  };

  const handleRefresh = () => {
    if (!loading) {
      loadLogs(true);
    }
  };

  // Filter logic supporting both old and new schema
  const displayedLogs = onlyAdditions
    ? logs.filter((entry) => {
        const monthlyDelta = Number(entry.tokens_monthly) || 0;
        const addedDelta = Number(entry.tokens_added) || 0;
        const legacyTokens = Number(entry.tokens) || 0;
        const hasNewSchema = entry.tokens_monthly !== undefined || entry.tokens_added !== undefined;
        return hasNewSchema ? (monthlyDelta > 0 || addedDelta > 0) : legacyTokens > 0;
      })
    : logs;

  return (
    <div className="token-usage-log">
      <div className="token-usage-log-header">
        <div className="token-usage-log-title-row">
          <span className="token-usage-log-title">Transaction Log</span>
          {isOpen && (
            <RefreshButton
              onClick={handleRefresh}
              disabled={!anonId && !authId}
              loading={loading}
              title="Refresh transaction log"
              size="small"
            />
          )}
        </div>
        <button
          type="button"
          className="token-usage-log-toggle-btn"
          onClick={toggleOpen}
          disabled={!anonId && !authId}
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>

      {isOpen && (
        <div className="token-usage-log-body">
          <div className="token-usage-log-controls">
            <label className="token-usage-log-checkbox">
              <input
                type="checkbox"
                checked={onlyAdditions}
                onChange={(e) => setOnlyAdditions(e.target.checked)}
              />
              <span>Show only additions</span>
            </label>
          </div>

          {loading && logs.length === 0 && (
            <div className="token-usage-log-status">Loading...</div>
          )}

          {error && (
            <div className="token-usage-log-status token-usage-log-status--error">
              {error}
            </div>
          )}

          {!loading && logs.length === 0 && !error && (
            <div className="token-usage-log-status">No transactions yet.</div>
          )}

          {displayedLogs.length > 0 && (
            <div className="token-usage-log-list">
              {displayedLogs.map((entry) => {
                // Support both old schema (tokens) and new schema (tokens_monthly, tokens_added)
                const monthlyDelta = Number(entry.tokens_monthly) || 0;
                const addedDelta = Number(entry.tokens_added) || 0;
                // Fallback for old entries that only have 'tokens' field
                const legacyTokens = Number(entry.tokens) || 0;
                const hasNewSchema = entry.tokens_monthly !== undefined || entry.tokens_added !== undefined;
                
                // For filtering: consider positive if any delta is positive
                const totalDelta = hasNewSchema ? (monthlyDelta + addedDelta) : legacyTokens;

                return (
                  <div
                    key={entry.id}
                    className="token-usage-log-row"
                  >
                    <div className="token-usage-log-row-main">
                      <div className="token-usage-log-note">
                        {entry.note || '(no description)'}
                      </div>
                      <div className="token-usage-log-meta">
                        <span className="token-usage-log-date">
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : '—'}
                        </span>
                        <span className="token-usage-log-id">ID: {entry.id}</span>
                      </div>
                    </div>
                    <div className="token-usage-log-tokens-container">
                      {hasNewSchema ? (
                        <>
                          {monthlyDelta !== 0 && (
                            <div
                              className={`token-usage-log-tokens ${
                                monthlyDelta > 0
                                  ? 'token-usage-log-tokens--positive'
                                  : 'token-usage-log-tokens--negative'
                              }`}
                              title="Monthly tokens"
                            >
                              <span className="token-usage-log-tokens-label">M:</span>
                              {monthlyDelta > 0 ? '+' : ''}
                              {monthlyDelta.toLocaleString()}
                            </div>
                          )}
                          {addedDelta !== 0 && (
                            <div
                              className={`token-usage-log-tokens ${
                                addedDelta > 0
                                  ? 'token-usage-log-tokens--positive'
                                  : 'token-usage-log-tokens--negative'
                              }`}
                              title="Added tokens"
                            >
                              <span className="token-usage-log-tokens-label">A:</span>
                              {addedDelta > 0 ? '+' : ''}
                              {addedDelta.toLocaleString()}
                            </div>
                          )}
                          {monthlyDelta === 0 && addedDelta === 0 && (
                            <div className="token-usage-log-tokens">0</div>
                          )}
                        </>
                      ) : (
                        <div
                          className={`token-usage-log-tokens ${
                            totalDelta > 0
                              ? 'token-usage-log-tokens--positive'
                              : 'token-usage-log-tokens--negative'
                          }`}
                        >
                          {totalDelta > 0 ? '+' : ''}
                          {totalDelta.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="token-usage-log-footer">
              <button
                type="button"
                className="token-usage-log-load-more"
                onClick={handleLoadMore}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TokenUsageLog;
