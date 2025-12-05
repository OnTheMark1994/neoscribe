import React from 'react';
import './TokenInfoModal.css';

function ConfirmCloseModal({ onSave, onDiscard, onCancel }) {
  return (
    <div className="token-modal-overlay" onClick={onCancel}>
      <div className="token-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="token-modal-title">Unsaved Changes</h2>
        <p style={{ marginBottom: '16px', color: '#cccccc' }}>
          You have unsaved changes. What would you like to do?
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={onSave}>
            Save and Exit
          </button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onDiscard}>
            Discard Changes
          </button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmCloseModal;
