import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectFlattenedChanges,
  selectActiveChangeId,
  setActiveChangeId,
  acceptAllProposals,
  rejectAllProposals,
} from '../store/aiSlice';

/**
 * AiNavBar - Bottom navigation bar for AI proposals
 * Shows current change count, prev/next navigation, and accept/reject all
 */
function AiNavBar({ aiManager, lineIdToNumber }) {
  const dispatch = useDispatch();
  const changes = useSelector(selectFlattenedChanges);
  const activeId = useSelector(selectActiveChangeId);

  if (!changes || changes.length === 0) return null;

  const currentIdx = changes.findIndex((c) => c.id === activeId);
  const displayIdx = currentIdx >= 0 ? currentIdx : 0;
  const total = changes.length;

  const handlePrev = () => {
    const newIdx = (displayIdx - 1 + total) % total;
    const newChange = changes[newIdx];
    dispatch(setActiveChangeId(newChange.id));
    if (aiManager) {
      aiManager.activeChangeId = newChange.id;
      aiManager.goToChange(newChange.id, lineIdToNumber);
    }
  };

  const handleNext = () => {
    const newIdx = (displayIdx + 1) % total;
    const newChange = changes[newIdx];
    dispatch(setActiveChangeId(newChange.id));
    if (aiManager) {
      aiManager.activeChangeId = newChange.id;
      aiManager.goToChange(newChange.id, lineIdToNumber);
    }
  };

  const handleAcceptAll = () => {
    if (aiManager && lineIdToNumber) {
      aiManager.acceptAll(changes, lineIdToNumber);
    }
    dispatch(acceptAllProposals());
  };

  const handleRejectAll = () => {
    if (aiManager) {
      aiManager.rejectAll();
    }
    dispatch(rejectAllProposals());
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '48px',
        background: 'linear-gradient(to bottom, #f5f5f5, #e8e8e8)',
        borderTop: '1px solid #ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        zIndex: 1000,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <button
        onClick={handlePrev}
        style={{
          background: '#fff',
          border: '1px solid #ccc',
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
        }}
        onMouseOver={(e) => (e.target.style.background = '#f0f0f0')}
        onMouseOut={(e) => (e.target.style.background = '#fff')}
      >
        ← Prev
      </button>

      <span
        style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#333',
          minWidth: '100px',
          textAlign: 'center',
        }}
      >
        Change {displayIdx + 1} / {total}
      </span>

      <button
        onClick={handleNext}
        style={{
          background: '#fff',
          border: '1px solid #ccc',
          padding: '6px 12px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
        }}
        onMouseOver={(e) => (e.target.style.background = '#f0f0f0')}
        onMouseOut={(e) => (e.target.style.background = '#fff')}
      >
        Next →
      </button>

      <div
        style={{
          width: '1px',
          height: '24px',
          background: '#ccc',
          margin: '0 8px',
        }}
      />

      <button
        onClick={handleAcceptAll}
        style={{
          background: '#4caf50',
          color: 'white',
          border: 'none',
          padding: '6px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
        }}
        onMouseOver={(e) => (e.target.style.background = '#45a049')}
        onMouseOut={(e) => (e.target.style.background = '#4caf50')}
      >
        ✓ Accept All
      </button>

      <button
        onClick={handleRejectAll}
        style={{
          background: '#f44336',
          color: 'white',
          border: 'none',
          padding: '6px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
        }}
        onMouseOver={(e) => (e.target.style.background = '#da190b')}
        onMouseOut={(e) => (e.target.style.background = '#f44336')}
      >
        ✗ Reject All
      </button>
    </div>
  );
}

export default AiNavBar;
