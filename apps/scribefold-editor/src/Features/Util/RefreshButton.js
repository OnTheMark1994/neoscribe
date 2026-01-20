/*
 
 
  */
import React from 'react';
import './RefreshButton.css';

export default function RefreshButton({ onClick, disabled, loading, title }) {
  return (
    <button
      className={`refresh-btn ${loading ? 'spinning' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      type="button"
    >
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 21h5v-5" />
      </svg>
    </button>
  );
}
