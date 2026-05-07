import React from 'react';
import Window from './Window';
import './ConfirmDialog.css';

export default function ConfirmDialog({ 
  open, 
  onClose, 
  onConfirm, 
  message, 
  confirmText = 'Confirm', 
  rejectText = 'Cancel',
  title = 'Confirm'
}) {
  return (
    <Window
      title={title}
      onClose={onClose}
      open={open}
      className="confirmDialog"
    >
        <p className="confirmDialogMessage">{message}</p>
        <div className="confirmDialogButtons">
          <button 
            className="confirmDialogBtn confirmDialogBtn-confirm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
          <button 
            className="confirmDialogBtn confirmDialogBtn-reject"
            onClick={onClose}
          >
            {rejectText}
          </button>
        </div>
    </Window>
  );
}
