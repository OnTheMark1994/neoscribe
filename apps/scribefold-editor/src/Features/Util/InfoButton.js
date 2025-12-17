/*
  Reusable circular info button.

  Used in places like the AI token row next to the refresh button.
  Accepts standard button props and renders a simple "i".
*/
import React from 'react';
import './InfoButton.css';

export default function InfoButton({ onClick, disabled, title }) {
  return (
    <button
      className="infoButton"
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      i
    </button>
  );
}
