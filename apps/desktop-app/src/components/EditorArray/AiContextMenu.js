import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectAiContextMenu, hideAiContextMenu, bumpAiDecorationsNonce, bumpArrayDecorationsNonce } from '../../store/aiUiSlice';
import { selectViewType, setContent } from '../../store/editorSlice';
import { getLines, updateLineText, recomputeVisibleLines, getTextFromLines, getAiModeFromText, applyAiModeToText } from '../../utils/editorEngine';
import './AiContextMenu.css';

/**
 * AiContextMenu - Shared AI context menu for array and Monaco views
 * 
 * WHAT: Shows AI sharing options (Share All, Summary, Title Only, Hide) for chapter/section lines
 * WHY HERE: Single component handles both views, reads source/lineKey from Redux to know which line to update
 * 
 * FLOW:
 * 1. User right-clicks fold button (array) or glyph (Monaco) → dispatch(showAiContextMenu) with source/lineKey
 * 2. Menu renders with current AI mode highlighted
 * 3. User clicks option → updates line text with appropriate #ai-* tag
 * 4. For array: updates editorEngine directly
 * 5. For Monaco: accesses editor via window.__monacoEditorRef and updates model
 */
function AiContextMenu() {
  const dispatch = useDispatch();
  const aiMenu = useSelector(selectAiContextMenu);
  const viewType = useSelector(selectViewType);

  if (!aiMenu.visible) return null;

  const { x, y, level, source, lineKey } = aiMenu;

  /**
   * Get current AI mode for the line from its text content
   */
  const getCurrentMode = () => {
    let lineText = '';
    
    if (source === 'array') {
      const lines = getLines();
      if (lines && typeof lineKey === 'number' && lines[lineKey]) {
        lineText = lines[lineKey].text || '';
      }
    } else if (source === 'monaco') {
      // Access Monaco editor via global ref set by SimpleMonaco
      const editor = window.__monacoEditorRef?.current;
      if (editor) {
        const model = editor.getModel();
        if (model && typeof lineKey === 'number') {
          lineText = model.getLineContent(lineKey) || '';
        }
      }
    }

    // Determine mode from trailing #tags suffix
    return getAiModeFromText(lineText);
  };

  const currentMode = getCurrentMode();

  /**
   * Handle selecting an AI mode option
   */
  const handleSelectMode = (mode) => {
    if (source === 'array') {
      // ARRAY VIEW: update in-memory metadata only; tags are added on save by editorEngine
      const lines = getLines();
      if (lines && typeof lineKey === 'number' && lines[lineKey]) {
        // Keep line.text clean; just update sendToAI so getTextFromLines()
        // can encode the correct #tags suffix when we persist content.
        lines[lineKey].sendToAI = mode;
        
        // Recompute visible lines in case any AI-dependent UI wants to react
        recomputeVisibleLines();

        // Signal array editor to refresh AI indicators without touching content text
        dispatch(bumpArrayDecorationsNonce());
      }
    } else if (source === 'monaco') {
      // Update Monaco model directly
      const editor = window.__monacoEditorRef?.current;
      const monaco = window.__monacoInstance;
      
      if (editor && monaco && typeof lineKey === 'number') {
        const model = editor.getModel();
        if (model) {
          const lineContent = model.getLineContent(lineKey) || '';
          const newText = applyAiModeToText(lineContent, mode);

          // Use pushEditOperations for undo support
          model.pushEditOperations(
            [],
            [{
              range: new monaco.Range(lineKey, 1, lineKey, lineContent.length + 1),
              text: newText,
            }],
            () => null
          );
          // Bump decorations nonce so SimpleMonaco knows to recompute glyphs
          dispatch(bumpAiDecorationsNonce());
        }
      }
    }

    dispatch(hideAiContextMenu());
  };

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

  // Radio button display helper
  const RadioIcon = ({ selected }) => (
    <span className={`ai-menu-radio ${selected ? 'ai-menu-radio--selected' : ''}`}>
      {selected ? '●' : '○'}
    </span>
  );

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
        <div className="ai-context-menu-header">
          {showChapterItems ? 'Chapter AI Settings' : 'Section AI Settings'}
        </div>
        <div className="ai-context-menu-divider" />
        
        <div 
          className={`ai-context-menu-item ${currentMode === 'all' ? 'ai-context-menu-item--active' : ''}`}
          onClick={() => handleSelectMode('all')}
        >
          <RadioIcon selected={currentMode === 'all'} />
          <span>Share All</span>
        </div>
        
        <div 
          className={`ai-context-menu-item ${currentMode === 'summary' ? 'ai-context-menu-item--active' : ''}`}
          onClick={() => handleSelectMode('summary')}
        >
          <RadioIcon selected={currentMode === 'summary'} />
          <span>Summary Only</span>
        </div>
        
        <div 
          className={`ai-context-menu-item ${currentMode === 'title' ? 'ai-context-menu-item--active' : ''}`}
          onClick={() => handleSelectMode('title')}
        >
          <RadioIcon selected={currentMode === 'title'} />
          <span>Title Only</span>
        </div>
        
        <div 
          className={`ai-context-menu-item ${currentMode === 'none' ? 'ai-context-menu-item--active' : ''}`}
          onClick={() => handleSelectMode('none')}
        >
          <RadioIcon selected={currentMode === 'none'} />
          <span>Hide from AI</span>
        </div>
      </div>
    </div>
  );
}

export default AiContextMenu;
