import React from 'react';
import './Window.css';

// Generic window/modal with title bar and close button
function Window({ title, onClose, className = '', children }) {
  return (
    <div className="window-overlay" onClick={onClose}>
      <div
        className={`window-container ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="window-titlebar">
          <div className="window-title">{title}</div>
          <div className="window-titlebar-right" onClick={onClose}>
            <button
              type="button"
              className="window-close-btn"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        <div className="window-body">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Window;
