import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Window from './Window';
import { isWeb } from '../../utils/environment';
import { getTextFromLines } from '../../utils/editorEngine';
import { downloadTextFile } from '../../utils/webFileOps';
import { selectShowDownloadModal, closeDownloadModal } from '../../store/uiSlice';
import { selectCurrentFilePath } from '../../store/editorSlice';

// WHAT: Web-only download info modal explaining how to save in the browser.
// WHY HERE: Extracted from Menus to avoid large inline JSX and keep Menus focused on wiring.
function DownloadInfoModal() {
  const dispatch = useDispatch();
  const showDownloadModal = useSelector(selectShowDownloadModal);
  const currentFilePath = useSelector(selectCurrentFilePath);

  if (!isWeb() || !showDownloadModal) return null;

  const handleWebDownloadFile = () => {
    const content = getTextFromLines();
    const fileName = currentFilePath || 'document.txt';
    downloadTextFile(content, fileName);
    dispatch(closeDownloadModal());
  };

  return (
    <Window
      title="Download"
      onClose={() => dispatch(closeDownloadModal())}
      className="window-medium"
    >
      <div className="download-info-body">
        <p className="download-info-text">
          The browser cannot save directly to your file system so to keep your work
          download a text file version of your document or download the desktop app so
          you can save directly.
        </p>
        <div className="download-info-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={handleWebDownloadFile}
          >
            Download Text File
          </button>
          <button
            type="button"
            className="btn-secondary download-info-desktop-btn"
            onClick={() => {
              window.open(
                'https://scribefold-ai-monorepo.onrender.com/#/downloads',
                '_blank',
                'noopener,noreferrer'
              );
            }}
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
  );
}

export default DownloadInfoModal;
