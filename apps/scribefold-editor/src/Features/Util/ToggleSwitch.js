/*


 */
import React from 'react';
import './ToggleSwitch.css';

export default function ToggleSwitch({ on, onClick, title, disabled }) {
  return (
    <button
      type="button"
      className={`toggleSwitch ${on ? 'toggleSwitch_on' : ''}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    />
  );
}
