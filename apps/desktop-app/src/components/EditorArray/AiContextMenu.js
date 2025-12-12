import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectAiContextMenu, hideAiContextMenu } from '../../store/aiUiSlice';
import './AiContextMenu.css';

function AiContextMenu() {
  const dispatch = useDispatch();
  const aiMenu = useSelector(selectAiContextMenu);

  if (!aiMenu.visible) return null;

  const { x, y, level } = aiMenu;

  const handleRootClick = (e) => {
    e.stopPropagation();
  };

  const handleBackgroundClick = () => {
    dispatch(hideAiContextMenu());
  };

  const handleBackdropContextMenu = (e) => {
    e.preventDefault();
    dispatch(hideAiContextMenu());
  };

  const showChapterItems = level === 1;
  const showSectionItems = level === 2 || level === 1;

  return (
    <div
      className="ai-context-menu-backdrop"
      onClick={handleBackgroundClick}
      onContextMenu={handleBackdropContextMenu}
    >
      <div
        className="ai-context-menu-root"
        style={{ left: x, top: y }}
        onClick={handleRootClick}
      >
        <div className="ai-context-menu-item">
          {showChapterItems ? 'Chapter' : 'Section'}
        </div>
        {showSectionItems && (
          <div
            className="ai-context-menu-item ai-context-menu-item--submenu"
          >
            <span>{showChapterItems ? 'Chapter AI' : 'Section AI'}</span>
            <span>{'>'}</span>
            <div className="ai-context-menu-submenu">
              <div className="ai-context-menu-radio-row">
                <span>○</span>
                <span>Share</span>
              </div>
              <div className="ai-context-menu-radio-row">
                <span>○</span>
                <span>Summary</span>
              </div>
              <div className="ai-context-menu-radio-row">
                <span>○</span>
                <span>Title Only</span>
              </div>
              <div className="ai-context-menu-radio-row">
                <span>○</span>
                <span>Hide</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AiContextMenu;
