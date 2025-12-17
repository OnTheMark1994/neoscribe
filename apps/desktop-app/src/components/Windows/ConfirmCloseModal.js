import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import './TokenInfoModal.css';
import { selectShowUnsavedDialog, closeUnsavedDialog } from '../../store/uiSlice';

function ConfirmCloseModal() {
  const dispatch = useDispatch();
  const showUnsavedDialog = useSelector(selectShowUnsavedDialog);

  if (!showUnsavedDialog) {
    return null;
  }

  const respondAndClose = (action) => {
    dispatch(closeUnsavedDialog());
    if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
      window.electronAPI.unsavedChangesResponse(action);
    }
  };

  return (
    <div className="token-modal-overlay" onClick={() => respondAndClose('cancel')}>
      <div className="token-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="token-modal-title">Unsaved Changes</h2>
        <p style={{ marginBottom: '16px', color: '#cccccc' }}>
          You have unsaved changes. What would you like to do?
        </p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button
            className="btn-primary"
            style={{ flex: 1 }}
            onClick={() => respondAndClose('save')}
          >
            Save and Exit
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => respondAndClose('discard')}
          >
            Discard Changes
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => respondAndClose('cancel')}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmCloseModal;
