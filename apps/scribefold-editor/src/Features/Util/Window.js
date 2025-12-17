/*
 
 
  */
import React from 'react';

export default function Window({ title, open, onClose, children }) {

  if (!open) return null;

  return (
    <div className="windowOverlay">
      <div className="windowContainer">
        <div className="windowTopBar">
          <div className="windowTitle">{title}</div>
          <button className="windowCloseButton" onClick={onClose} type="button">
            X
          </button>
        </div>
        <div className="windowContent">
          {children}
        </div>
      </div>
    </div>
  );
}
