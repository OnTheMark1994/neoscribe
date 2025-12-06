import React, { useState } from 'react';
import './Settings.css';
import { fetchUserTokenLog } from '../utils/aiService';

function TokenUsageLog({ anonId, authId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const pageSize = 20;

  const toggleOpen = async () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen && logs.length === 0 && !loading) {
      await loadPage(0, true);
    }
  };

  const loadPage = async (newOffset, replace = false) => {
    if (!anonId && !authId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchUserTokenLog(anonId, authId, {
        limit: pageSize,
        offset: newOffset,
      });

      const newLogs = Array.isArray(result.logs) ? result.logs : [];
      setHasMore(!!result.hasMore);
      setOffset(newOffset + newLogs.length);

      if (replace) {
        setLogs(newLogs);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load token usage log');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loading || !hasMore) return;
    await loadPage(offset, false);
  };

  return (
    <div className="token-usage-log">
      <button
        type="button"
        className="token-usage-log-toggle btn-secondary"
        onClick={toggleOpen}
        disabled={!anonId && !authId}
      >
        {isOpen ? 'Hide Usage Log' : 'View Usage Log'}
      </button>

      {isOpen && (
        <div className="token-usage-log-panel">
          {loading && logs.length === 0 && (
            <div className="token-usage-log-status">Loading token usage log...</div>
          )}

          {error && (
            <div className="token-usage-log-status token-usage-log-status--error">{error}</div>
          )}

          {!loading && logs.length === 0 && !error && (
            <div className="token-usage-log-status">No log entries yet.</div>
          )}

          {logs.length > 0 && (
            <div className="token-usage-log-list">
              {logs.map((entry) => {
                const tokensValue = Number(entry.tokens) || 0;
                const signClass = tokensValue < 0 ? 'token-usage-log-tokens--negative' : 'token-usage-log-tokens--positive';

                return (
                  <div key={entry.id || `${entry.user_id}-${entry.created_at}-${tokensValue}`} className="token-usage-log-row">
                    <div className="token-usage-log-main">
                      <div className="token-usage-log-note">{entry.note || '(no note)'}</div>
                      <div className="token-usage-log-meta">
                        <span className="token-usage-log-date">
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : '(no timestamp)'}
                        </span>
                        <span className="token-usage-log-id">id: {entry.id}</span>
                      </div>
                    </div>
                    <div className={`token-usage-log-tokens ${signClass}`}>
                      {tokensValue.toLocaleString()}
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
                className="btn-secondary token-usage-log-load-more"
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
