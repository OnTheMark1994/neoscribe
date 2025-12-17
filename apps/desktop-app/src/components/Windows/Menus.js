import React from 'react';
import SettingsNew from '../settingsnew/SettingsNew';
import DownloadInfoModal from './DownloadInfoModal';
import ConfirmCloseModal from './ConfirmCloseModal';

/**
 * Menus - Centralized container for ALL modals
 * 
 * Purpose: Render all modals in one place, controlled by Redux state.
 * This eliminates modal rendering scattered throughout App.js.
 * 
 * Design: Reads visibility flags from uiSlice and renders appropriate modals.
 * Modal close actions dispatch Redux actions.
 */
function Menus() {
  return (
    <>
      {/* Unsaved changes dialog */}
      <ConfirmCloseModal />
      <SettingsNew />
      <DownloadInfoModal />
    </>
  );
}

export default Menus;
