import React from 'react';
import './DiffActionButtons.css';

function DiffActionButtons({ proposedChangeId, changeType, activeChangeId }) {
  const isActive = activeChangeId === proposedChangeId;

  const handleDisabledClick = () => {
    // Placeholder: no-op while logic is disabled
    console.log('[DiffActionButtons] Clicked (UI-only mode)', {
      proposedChangeId,
      changeType,
    });
  };

  return (
    <div 
      className={`diff-actions-inline${isActive ? ' diff-actions-active' : ''}`}
      data-change-id={proposedChangeId}
    >
      {changeType === 'delete' && (
        <span className="delete-indicator">DELETE THIS LINE</span>
      )}
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px', fontFamily: 'monospace' }}>
        My ID: {proposedChangeId} | Active: {activeChangeId || 'none'} | Match: {isActive ? 'YES' : 'NO'}
      </div>
      <button 
        className="diff-btn-inline diff-btn-reject" 
        onClick={handleDisabledClick}
      >
        Reject
      </button>
      <button 
        className="diff-btn-inline diff-btn-accept" 
        onClick={handleDisabledClick}
      >
        Accept
      </button>
      <button
        type="button"
        className="diff-auto-advance-toggle"
        onClick={handleDisabledClick}
        title="Jump to next change (UI-only)"
      >
        <span className="diff-toggle-track">
          <span className="diff-toggle-knob" />
        </span>
        <span className="diff-toggle-label">Jump</span>
      </button>
    </div>
  );
}

export default DiffActionButtons;
