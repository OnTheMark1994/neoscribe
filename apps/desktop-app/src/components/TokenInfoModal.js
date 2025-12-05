import React from 'react';
import './TokenInfoModal.css';

function TokenInfoModal({ estimate, onClose }) {
  if (!estimate) return null;

  return (
    <div className="token-modal-overlay" onClick={onClose}>
      <div className="token-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="token-modal-title">Token Usage Breakdown</h2>
        
        <div className="token-total-box">
          <div className="token-total-number">
            ~{estimate.total.toLocaleString()} tokens
          </div>
          <div className="token-total-label">
            Estimated per AI request
          </div>
        </div>
        
        <div className="token-components">
          <div className="token-components-title">Components:</div>
          
          <div className="token-component-row">
            <span>System Prompt</span>
            <span className="token-value">{estimate.system.toLocaleString()} tokens</span>
          </div>
          
          <div className="token-component-row">
            <span>Document Content</span>
            <span className="token-value">{estimate.content.toLocaleString()} tokens</span>
          </div>
          
          <div className="token-component-row">
            <span>Your Message (avg)</span>
            <span className="token-value-orange">{estimate.userMessage.toLocaleString()} tokens</span>
          </div>
          
          <div className="token-component-row">
            <span>AI Response (est)</span>
            <span className="token-value-orange">{estimate.response.toLocaleString()} tokens</span>
          </div>
        </div>
        
        <div className="token-note-box">
          <div className="token-note-text">
            <strong>Notes:</strong> 
            <ul>
              <li>Blue color and eye icons indicate which content is being shared with the AI</li>
              <li>To adjust this right click on the +/- circle by any Chapter or Section</li>
              <li>Select show, show title only, or hide to control token usage</li>
              <li>This is an estimate. Actual usage varies and is calculated on use</li>
            </ul>
          </div>
        </div>
        
        <button className="token-close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export default TokenInfoModal;
