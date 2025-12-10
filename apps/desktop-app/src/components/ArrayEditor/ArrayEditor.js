import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  parseText, 
  getTextFromLines, 
  updateLinesFromText, 
  getLines,
  setLines 
} from '../../utils/editorEngine';
import { 
  selectContent, 
  selectIsModified,
  setIsModified 
} from '../../store/editorSlice';
import { selectIsAIEnabled } from '../../store/settingsSlice';
import FoldEditorView from '../FoldEditorView';

/**
 * ArrayEditor.js
 * 
 * Manages fold-based editor with editorEngine lines array.
 * Handles chapters/sections, folding, AI features, line editing.
 * 
 * This is array view ONLY - Monaco and textarea don't use this.
 */
function ArrayEditor() {
  const dispatch = useDispatch();
  const reduxContent = useSelector(selectContent);
  const isModified = useSelector(selectIsModified);
  const isAIEnabled = useSelector(selectIsAIEnabled);
  
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [isArrayView, setIsArrayView] = useState(true); // Legacy debug toggle
  
  const editorRef = useRef(null);
  const { currentChangeIdIndex, allChangeIds } = useSelector(state => state.aiChanges);

  // Initialize editorEngine when Redux content changes (file open)
  useEffect(() => {
    if (reduxContent) {
      parseText(reduxContent);
      setRenderTrigger(prev => prev + 1);
    }
  }, [reduxContent]);

  // NOTE: foldAll/unfoldAll are currently only callable from inside ArrayEditor.
  // WebMenuBar still needs to be refactored to trigger them via Redux.

  /**
   * renderEditor - Increment renderTrigger to force re-render
   * Called internally after any editorEngine lines mutation
   */
  const renderEditor = () => {
    setRenderTrigger(prev => prev + 1);
  };

  /**
   * toggleFold - Toggle fold state of a single chapter/section
   * Called internally from FoldEditorView when user clicks fold icon
   */
  const toggleFold = (idx) => {
    const lines = getLines();
    lines[idx].open = !lines[idx].open;

    // Keep #folded tag in sync with open state
    let text = lines[idx].text.replace(/#folded\b/gi, '').trim();
    if (!lines[idx].open) {
      text += ' #folded';
    }
    lines[idx].text = text;

    renderEditor();
    if (!isModified) {
      dispatch(setIsModified(true));
    }
  };

  /**
   * foldAll - Fold all chapters/sections
   * Called externally via Redux trigger from WebMenuBar
   */
  const foldAll = () => {
    const lines = getLines();
    lines.forEach(line => {
      if (line.startIdx !== -1 && line.endIdx >= line.startIdx) {
        line.open = false;
        if (!line.text.includes('#folded')) {
          line.text = line.text.trim() + ' #folded';
        }
      }
    });
    renderEditor();
    if (!isModified) {
      dispatch(setIsModified(true));
    }
  };

  /**
   * unfoldAll - Unfold all chapters/sections
   * Called externally via Redux trigger from WebMenuBar
   */
  const unfoldAll = () => {
    const lines = getLines();
    lines.forEach(line => {
      if (line.startIdx !== -1) {
        line.open = true;
        line.text = line.text.replace(/#folded\b/gi, '').trim();
      }
    });
    renderEditor();
    if (!isModified) {
      dispatch(setIsModified(true));
    }
  };

  /**
   * isLineHidden - Check if line is hidden by parent fold
   * Called internally by getVisibleLines
   */
  const isLineHidden = (lineIdx) => {
    const lines = getLines();
    for (let j = lineIdx - 1; j >= 0; j--) {
      const p = lines[j];
      if (p.startIdx !== -1 && p.endIdx >= lineIdx && !p.open) {
        return true;
      }
    }
    return false;
  };

  /**
   * getVisibleLines - Filter lines array to only visible (not folded)
   * Called internally to pass to FoldEditorView for rendering
   */
  const getVisibleLines = () => {
    const lines = getLines();
    const visible = [];
    
    for (let i = 0; i < lines.length; i++) {
      if (!isLineHidden(i)) {
        visible.push({ line: lines[i], index: i });
      }
    }
    
    return visible;
  };

  /**
   * handleLineEdit - Update line text in editorEngine
   * Called internally from FoldEditorView when user edits a line
   */
  const handleLineEdit = (idx, newText) => {
    const lines = getLines();
    if (lines[idx]) {
      lines[idx].text = newText;
      if (!isModified) {
        dispatch(setIsModified(true));
      }
    }
  };

  /**
   * handleEnterKey - Split line at cursor, create new line
   * Called internally from FoldEditorView on Enter key
   */
  const handleEnterKey = (idx, element) => {
    const lines = getLines();
    const sel = window.getSelection();
    if (sel.rangeCount === 0) return;
    
    const range = sel.getRangeAt(0);
    const offset = range.startOffset;
    
    const currentText = element.textContent;
    const beforeCursor = currentText.substring(0, offset);
    const afterCursor = currentText.substring(offset);
    
    lines[idx].text = beforeCursor;
    lines.splice(idx + 1, 0, {
      text: afterCursor,
      open: true,
      level: 0,
      startIdx: -1,
      endIdx: -1,
      sendToAI: 'all',
      id: Math.random().toString(36).substr(2, 9)
    });
    
    // Auto-expand closed sections if new line created inside
    const newLineIdx = idx + 1;
    for (let j = newLineIdx - 1; j >= 0; j--) {
      const p = lines[j];
      if (p.startIdx !== -1 && p.endIdx >= newLineIdx && !p.open) {
        lines[j].open = true;
        lines[j].text = lines[j].text.replace(/#folded\b/gi, '').trim();
        break;
      }
    }
    
    const text = getTextFromLines();
    updateLinesFromText(text);
    renderEditor();
    dispatch(setIsModified(true));
    
    // Focus new line
    setTimeout(() => {
      const newLine = document.querySelector(`[data-idx="${idx + 1}"].line-content`);
      if (newLine) newLine.focus();
    }, 0);
  };

  /**
   * handleBackspaceAtStart - Merge current line with previous
   * Called internally from FoldEditorView on Backspace at line start
   */
  const handleBackspaceAtStart = (idx, element) => {
    const lines = getLines();
    if (idx === 0) return;
    
    const currentText = lines[idx].text;
    const prevText = lines[idx - 1].text;
    const mergedText = prevText + currentText;
    
    lines[idx - 1].text = mergedText;
    lines.splice(idx, 1);
    
    const text = getTextFromLines();
    updateLinesFromText(text);
    renderEditor();
    dispatch(setIsModified(true));
    
    // Focus previous line
    setTimeout(() => {
      const prevLine = document.querySelector(`[data-idx="${idx - 1}"].line-content`);
      if (prevLine) prevLine.focus();
    }, 0);
  };

  /**
   * showAIContextMenu - Show Electron native context menu with AI options
   * Called internally from FoldEditorView on right-click
   * TODO: Move to WebMenuBar when migrating to unified menu
   */
  const showAIContextMenu = (x, y, lineIdx) => {
    const lines = getLines();
    const line = lines[lineIdx];

    if (window.electronAPI && window.electronAPI.showAIContextMenu && line) {
      window.electronAPI.showAIContextMenu({
        lineIdx,
        sendToAI: line.sendToAI,
        level: line.level,
        isOpen: line.open
      });
    }
  };

  /**
   * cleanAITags - Remove all AI tags from text
   * Called internally by AI functions
   */
  const cleanAITags = (text) => {
    return text
      .replace(/#ai-title\b/gi, '')
      .replace(/#aititle\b/gi, '')
      .replace(/#ai-summary\b/gi, '')
      .replace(/#aisummary\b/gi, '')
      .replace(/#ai-hide\b/gi, '')
      .replace(/#aihide\b/gi, '')
      .trim();
  };

  /**
   * applyAIModeToLine - Add AI tags to line text
   * Called internally by AI menu handlers
   */
  const applyAIModeToLine = (lines, idx, mode) => {
    let text = cleanAITags(lines[idx].text);
    if (mode === 'title') {
      text += ' #ai-title';
    } else if (mode === 'summary') {
      text += ' #ai-summary';
    } else if (mode === 'none') {
      text += ' #ai-hide';
    }
    lines[idx].text = text;
    lines[idx].sendToAI = mode === 'all' ? 'all' : mode;
  };

  /**
   * applyAIModeToSections - Apply AI mode to all sections in chapter
   * Called internally by AI menu handlers
   */
  const applyAIModeToSections = (lines, rootIdx, mode) => {
    let start = rootIdx;
    let end = lines[rootIdx].endIdx >= 0 ? lines[rootIdx].endIdx : lines.length - 1;

    let chapterIdx = null;
    if (lines[rootIdx].level === 1) {
      chapterIdx = rootIdx;
    }

    if (lines[rootIdx].level === 2) {
      for (let j = rootIdx - 1; j >= 0; j--) {
        if (lines[j].level === 1 && lines[j].startIdx !== -1) {
          start = j;
          end = lines[j].endIdx >= 0 ? lines[j].endIdx : end;
          chapterIdx = j;
          break;
        }
      }
    }

    if (chapterIdx !== null) {
      let chapterText = cleanAITags(lines[chapterIdx].text);
      lines[chapterIdx].text = chapterText;
      lines[chapterIdx].sendToAI = 'all';
    }

    for (let i = start; i <= end; i++) {
      if (lines[i].startIdx !== -1 && lines[i].level === 2) {
        applyAIModeToLine(lines, i, mode);
      }
    }
  };

  /**
   * ensureChapterSummarySection - Create #summary section if missing
   * Called internally by AI menu handlers
   */
  const ensureChapterSummarySection = (chapterIdx) => {
    const lines = getLines();
    const chapter = lines[chapterIdx];
    if (!chapter || chapter.level !== 1) return;

    const textLines = getTextFromLines().split('\n');
    const total = textLines.length;
    const start = chapterIdx;
    const end = typeof chapter.endIdx === 'number' && chapter.endIdx >= chapterIdx
      ? chapter.endIdx
      : total - 1;

    let hasSummary = false;
    for (let i = start; i <= end && i < total; i++) {
      const t = (textLines[i] || '').trim();
      if (/^#summary(?:\s|$)/i.test(t)) {
        hasSummary = true;
        break;
      }
    }

    if (!hasSummary) {
      textLines.splice(chapterIdx + 1, 0, '#summary', '<summary>');
      const newText = textLines.join('\n');
      updateLinesFromText(newText);
      renderEditor();
      dispatch(setIsModified(true));
    }
  };

  /**
   * extractContent - Get full text from editorEngine
   * Called externally by WebMenuBar when saving file
   */
  const extractContent = () => {
    return getTextFromLines();
  };

  // Expose extractContent via ref for WebMenuBar
  React.useImperativeHandle(editorRef, () => ({
    extractContent
  }));

  return (
    <FoldEditorView
      ref={editorRef}
      visibleLines={getVisibleLines()}
      isArrayView={isArrayView}
      onToggleFold={toggleFold}
      onContentChange={() => dispatch(setIsModified(true))}
      onRenderEditor={renderEditor}
      currentChangeId={allChangeIds[currentChangeIdIndex]}
      onShowAIContextMenu={showAIContextMenu}
      isAIEnabled={isAIEnabled}
      renderTrigger={renderTrigger}
    />
  );
}

export default ArrayEditor;
