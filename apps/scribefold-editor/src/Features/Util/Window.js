/*
 
 
  */
import React from 'react';
import './Window.css';

export default function Window({ title, open, onClose, children, className = '' }) {

  if (!open) return null;

  return (
    <div className="windowOverlay">
      <div className={`windowContainer ${className}`}>
        <div className="windowTopBar">
          <div className="windowTitle">{title}</div>
          <button
            className="windowCloseButton"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="windowContent">
          {children}
        </div>
      </div>
    </div>
  );
}
