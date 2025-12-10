import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectIsSettingsOpen,
  selectSettingsTab,
  selectShowUnsavedDialog,
  selectShowDownloadModal,
  closeSettings,
  closeUnsavedDialog,
  closeDownloadModal,
} from '../../store/uiSlice';
import { selectCurrentFilePath } from '../../store/editorSlice';
import { isWeb } from '../../utils/environment';
import { getTextFromLines } from '../../utils/editorEngine';
import { downloadTextFile } from '../../utils/webFileOps';
import ConfirmCloseModal from './ConfirmCloseModal';
import Settings from '../Settings/Settings';
import Window from './Window';

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
  const dispatch = useDispatch();
  const isSettingsOpen = useSelector(selectIsSettingsOpen);
  const settingsTab = useSelector(selectSettingsTab);
  const showUnsavedDialog = useSelector(selectShowUnsavedDialog);
  const showDownloadModal = useSelector(selectShowDownloadModal);
  const currentFilePath = useSelector(selectCurrentFilePath);

  // Unsaved changes dialog handlers
  const handleUnsavedSave = () => {
    dispatch(closeUnsavedDialog());
    if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
      window.electronAPI.unsavedChangesResponse('save');
    }
  };

  const handleUnsavedDiscard = () => {
    dispatch(closeUnsavedDialog());
    if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
      window.electronAPI.unsavedChangesResponse('discard');
    }
  };

  const handleUnsavedCancel = () => {
    dispatch(closeUnsavedDialog());
    if (window.electronAPI && window.electronAPI.unsavedChangesResponse) {
      window.electronAPI.unsavedChangesResponse('cancel');
    }
  };

  // Download modal handler (web only)
  const handleWebDownloadFile = () => {
    const content = getTextFromLines();
    const fileName = currentFilePath || 'document.txt';
    downloadTextFile(content, fileName);
    dispatch(closeDownloadModal());
  };

  return (
    <>
      {/* Unsaved changes dialog */}
      {showUnsavedDialog && (
        <ConfirmCloseModal
          onSave={handleUnsavedSave}
          onDiscard={handleUnsavedDiscard}
          onCancel={handleUnsavedCancel}
        />
      )}

      {/* Web-only Settings modal */}
      {isSettingsOpen && (
        <Window
          title="Settings"
          onClose={() => dispatch(closeSettings())}
          className="window-large"
        >
          <Settings
            onClose={() => dispatch(closeSettings())}
            initialTab={settingsTab || 'general'}
          />
        </Window>
      )}

      {/* Web-only Download info modal */}
      {isWeb() && showDownloadModal && (
        <Window
          title="Download"
          onClose={() => dispatch(closeDownloadModal())}
          className="window-medium"
        >
          <div style={{ color: '#e0e0e0', fontSize: '14px', lineHeight: 1.5, textAlign: 'center' }}>
            <p style={{ marginBottom: '12px' }}>
              The browser cannot save directly to your file system so to keep your
              work download a text file version of your document or download the
              desktop app so you can save directly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleWebDownloadFile}
              >
                Download Text File
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  window.open('https://scribefold-ai-monorepo.onrender.com/#/downloads', '_blank', 'noopener,noreferrer');
                }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <span>Download Desktop App</span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 3h7v7" />
                  <path d="M10 14L21 3" />
                  <path d="M5 5v16h16" />
                </svg>
              </button>
            </div>
          </div>
        </Window>
      )}
    </>
  );
}

export default Menus;
