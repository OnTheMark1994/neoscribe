import React, { useState } from 'react';
import { API_BASE_URL } from '../constants';
import './TokenUsageLog.css';

const TOKEN_LOG_PAGE_SIZE = 4;

function TokenUsageLog({ authId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [onlyAdditions, setOnlyAdditions] = useState(false);

  const toggleOpen = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && logs.length === 0 && !loading) {
      await loadLogs(true);
    }
  };

  const loadLogs = async (replace = false) => {
    if (!authId) {
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
          anonId: null,
          authId,
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
      // eslint-disable-next-line no-console
      console.error('[WEB TokenUsageLog] Error:', err);
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

  const displayedLogs = onlyAdditions
    ? logs.filter((entry) => Number(entry.tokens) > 0)
    : logs;

  return (
    <div className="sf-token-usage-log">
      <div className="sf-token-usage-log-header">
        <span className="sf-token-usage-log-title">Transaction Log</span>
        <button
          type="button"
          className="sf-token-usage-log-toggle-btn"
          onClick={toggleOpen}
          disabled={!authId}
          title={isOpen ? 'Collapse' : 'Expand'}
        >
          {isOpen ? '−' : '+'}
        </button>
      </div>

      {isOpen && (
        <div className="sf-token-usage-log-body">
          <div className="sf-token-usage-log-controls">
            <label className="sf-token-usage-log-checkbox">
              <input
                type="checkbox"
                checked={onlyAdditions}
                onChange={(e) => setOnlyAdditions(e.target.checked)}
              />
              <span>Show only additions</span>
            </label>
          </div>

          {loading && logs.length === 0 && (
            <div className="sf-token-usage-log-status">Loading...</div>
          )}

          {error && (
            <div className="sf-token-usage-log-status sf-token-usage-log-status-error">
              {error}
            </div>
          )}

          {!loading && logs.length === 0 && !error && (
            <div className="sf-token-usage-log-status">No transactions yet.</div>
          )}

          {displayedLogs.length > 0 && (
            <div className="sf-token-usage-log-list">
              {displayedLogs.map((entry) => {
                const tokensValue = Number(entry.tokens) || 0;
                const isPositive = tokensValue > 0;

                return (
                  <div
                    key={entry.id}
                    className="sf-token-usage-log-row"
                  >
                    <div className="sf-token-usage-log-row-main">
                      <div className="sf-token-usage-log-note">
                        {entry.note || '(no description)'}
                      </div>
                      <div className="sf-token-usage-log-meta">
                        <span className="sf-token-usage-log-date">
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : '—'}
                        </span>
                        <span className="sf-token-usage-log-id">ID: {entry.id}</span>
                      </div>
                    </div>
                    <div
                      className={
                        `sf-token-usage-log-tokens ${
                          isPositive
                            ? 'sf-token-usage-log-tokens-positive'
                            : 'sf-token-usage-log-tokens-negative'
                        }`
                      }
                    >
                      {isPositive ? '+' : ''}
                      {tokensValue.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasMore && (
            <div className="sf-token-usage-log-footer">
              <button
                type="button"
                className="sf-token-usage-log-load-more"
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
