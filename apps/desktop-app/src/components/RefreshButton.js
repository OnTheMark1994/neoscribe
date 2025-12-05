import React from 'react';
import './RefreshButton.css';

function RefreshButton({ onClick, disabled, loading, title, size = 'medium' }) {
  const sizeClass = size === 'small' ? 'refresh-btn-small' : 'refresh-btn-medium';
  const iconSize = size === 'small' ? 14 : 16;

  return (
    <button
      className={`refresh-btn ${sizeClass} ${loading ? 'spinning' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
    >
      <svg 
        width={iconSize} 
        height={iconSize} 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 21h5v-5"/>
      </svg>
    </button>
  );
}

export default RefreshButton;
