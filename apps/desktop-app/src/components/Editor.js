import React, { useState, useEffect, useRef, memo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { parseText, getTextFromLines, updateLinesFromText, getLines } from '../utils/editorEngine';
import { selectCurrentFilePath, selectIsModified, selectContent, setIsModified, setCurrentFilePath } from '../store/editorSlice';
import { selectIsAIEnabled, selectEditorViewMode } from '../store/settingsSlice';
import { showStatus as showStatusRedux } from '../store/statusSlice';
import FoldEditorView from './FoldEditorView';
import TextareaEditorView from './TextareaEditorView';
import MonacoEditorView from './MonacoEditorView';
import FindBar from './FindBar/FindBar';
import './Editor.css';
// REMOVED IMPORTS: isWeb, uploadTextFile - file operations moved to WebMenuBar + fileOps

/**
 * Editor - View orchestrator and content renderer
 * 
 * REFACTORED (Design Principle 11):
 * - File operations (new/open) moved to WebMenuBar + fileOps utility
 * - Editor now focuses on RENDERING content and managing VIEW state
 * - Reads content from Redux (populated by file operations)
 * 
 * REMAINING RESPONSIBILITIES:
 * - Manages three view modes: array (fold), monaco (code editor), textarea (plain text)
 * - Save operations (temporary - needs view-specific content extraction)
 * - Syncs content between views and editorEngine
 * - Dispatches isModified to Redux on content changes
 * 
 * TODO:
 * - Move save operations to shared module once content sync finalized
 * - Remove fold/unfold from imperative API, trigger via Redux
 * - Eliminate onEditorReady pattern entirely
 * 
 * STATE ARCHITECTURE:
 * - Redux: currentFilePath, content, isModified (updated by WebMenuBar on file ops)
 * - Local: viewMode (component-specific)
 * - Refs: filePathRef, monacoRef, textareaRef (for synchronous access)
 * - Module: editorEngine lines array (for fold view)
 */
function Editor({ onEditorReady }) {
  // Redux dispatch - used to update global state directly (NO PROP DRILLING)
  const dispatch = useDispatch();
  
  // Read from Redux - global state needed for UI sync
  const currentFilePath = useSelector(selectCurrentFilePath);
  const reduxContent = useSelector(selectContent); // Content from file operations
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const savedViewMode = useSelector(selectEditorViewMode);
  
  // Local state - view-specific, doesn't need to be in Redux
  const [content, setContent] = useState(''); // Plain text for Monaco/textarea views
  const [viewMode, setViewMode] = useState(() => { // 'array' | 'monaco' | 'textarea'
    // Initialize from Redux/localStorage
    const saved = savedViewMode || localStorage.getItem('editorViewMode');
    // Migrate old 'fold' value to 'array'
    if (saved === 'fold') return 'array';
    if (saved === 'array' || saved === 'monaco' || saved === 'textarea') return saved;
    return 'array'; // default
  });
  const [isArrayView, setIsArrayView] = useState(true); // Legacy toggle for array view debug
  const [renderTrigger, setRenderTrigger] = useState(0); // Forces re-render of fold view
  
  // Refs - for synchronous access without waiting for React re-render
  const editorRef = useRef(null); // Fold view container
  const textareaRef = useRef(null); // Direct access to textarea DOM
  const monacoRef = useRef(null); // Direct access to Monaco instance
  // REMOVED: menuListenersSetupRef, openDialogActiveRef - Electron native menu removed
  
  // CRITICAL: filePathRef is source of truth for save operations
  // WHY: Redux updates are async, filePathRef is synchronous
  // WHEN: Updated immediately when file opened/saved to prevent race condition on Ctrl+S
  const filePathRef = useRef(currentFilePath || null);
  const { currentChangeIdIndex, allChangeIds } = useSelector(state => state.aiChanges);
  
  // Find functionality - only for array/textarea views (Monaco has built-in Ctrl+F)
  const [isFindVisible, setIsFindVisible] = useState(false);

  // REMOVED: All function refs - no longer needed since Electron native menu removed
  // WebMenuBar calls these functions directly, no stale closure issues

  // Expose imperative editor helpers to parent (App)
  // NOTE (Design Principle 11 - Common Issues):
  //   PROGRESS: newFile/openFile moved to WebMenuBar + fileOps utility ✓
  //   PROGRESS: Electron native menu removed ✓
  //   TODO: Move save operations once content sync strategy finalized
  //   TODO: Move fold operations to Redux-triggered actions
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady({
        // AI operations - still here because they manipulate editorEngine directly
        updateLinesFromAI: (newLines) => {
          const { setLines } = require('../utils/editorEngine');
          setLines(newLines);
          try {
            const { getTextFromLines } = require('../utils/editorEngine');
            const text = getTextFromLines();
            setContent(text);
          } catch (e) {
            // Fallback: just bump render if anything goes wrong
          }
          setRenderTrigger(prev => prev + 1);
        },
        // View operations - closures capture latest function definitions
        toggleFoldView: () => cycleViewMode(),
        toggleArrayView: () => setIsArrayView(prev => !prev),
        setViewMode: (mode) => switchToViewMode(mode),
        getViewMode: () => viewMode,
        // Save operations - still here because they extract content from active view
        saveFile: () => handleSave(),
        saveFileAs: () => handleSaveAs(),
        // Fold operations - still here because they interact with view state
        foldAll: () => foldAll(),
        unfoldAll: () => unfoldAll()
        // REMOVED: newFile, openFile - now handled by WebMenuBar + fileOps utility
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEditorReady]); // Functions are stable, no need to re-create API on every change

  // Sync Redux content to local state when file operations happen (open/new)
  useEffect(() => {
    if (reduxContent !== undefined && reduxContent !== null) {
      setContent(reduxContent);
      parseText(reduxContent);
      renderEditor();
    }
  }, [reduxContent]);

  // Listen for view mode changes from Redux (no more polling!)
  useEffect(() => {
    if (savedViewMode && savedViewMode !== viewMode) {
      console.log('[EDITOR] View mode changed via Redux:', savedViewMode);
      switchToViewMode(savedViewMode, true);
    }
  }, [savedViewMode]);

  useEffect(() => {
    // Initialize editor
    parseText('');
    renderEditor();

    // REMOVED: Electron native menu listeners - unified WebMenuBar handles all menu actions
    // File operations now handled by WebMenuBar + fileOps utility

    // Hide loading screen immediately
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
  }, []);

  // REMOVED: Electron native AI context menu listener
  // Unified WebMenuBar handles all menu interactions in both Electron and web

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+S: Save - centralized here so it works in all views
      // Use capture phase (true) so we intercept before Monaco handles it
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('[EDITOR] Ctrl+S intercepted in parent Editor component');
        handleSave();
        return;
      }

      // Ctrl+F: Find
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        
        // Monaco has built-in find - trigger it
        if (viewMode === 'monaco') {
          if (monacoRef.current && window.monaco) {
            const action = monacoRef.current.getAction('actions.find');
            action && action.run();
          }
          return;
        }
        
        // Array/Textarea: Show our custom FindBar
        setIsFindVisible(true);
        return;
      }

      // Escape: Close find box (Monaco handles its own Escape)
      if (e.key === 'Escape' && isFindVisible) {
        setIsFindVisible(false);
        return;
      }
    };

    // Use capture phase (true) to intercept before Monaco or other components handle it
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isFindVisible, viewMode, monacoRef]);

  // REMOVED: Auto-highlight effect - now handled by FindBar component

  // Keep ref in sync with prop so async callbacks always see latest file path
  useEffect(() => {
    filePathRef.current = currentFilePath || null;
  }, [currentFilePath]);

  // ======================================================================
  // REMOVED: handleNew, handleOpen, openFile - moved to WebMenuBar + fileOps
  // File operations no longer live in Editor component
  // ======================================================================

  // ======================================================================
  // STILL CALLED EXTERNALLY via editorRef (WebMenuBar, Electron menus)
  // WHY: Needs to extract content from active view (array/monaco/textarea)
  // TODO: Move to shared module once content sync strategy finalized
  // ======================================================================
  
  const handleSave = async () => {
    if (!window.electronAPI) return;
    
    const filePath = filePathRef.current;
    console.log('[EDITOR] handleSave called, filePathRef.current:', filePath);
    
    // CRITICAL: Get content from the correct source based on current view mode
    let textContent;
    if (viewMode === 'array') {
      textContent = getTextFromLines();
    } else if (viewMode === 'monaco') {
      textContent = monacoRef.current?.getValue() ?? content ?? '';
    } else {
      // textarea view
      textContent = textareaRef.current?.value ?? content ?? '';
    }
    console.log('[EDITOR] Text content length:', textContent.length, 'from', viewMode, 'view');

    if (filePath) {
      console.log('[EDITOR] Saving to existing file:', filePath);
      console.log('[EDITOR] Text content length:', textContent.length);
      try {
        const result = await window.electronAPI.saveFile(filePath, textContent);
        if (result && result.success) {
          console.log('[EDITOR] File saved successfully');
          window.isModified = false;
          // Dispatch to Redux: Clear modified flag
          dispatch(setIsModified(false));

          // Read back from disk to verify what was written
          try {
            const diskContentResult = await window.electronAPI.readFile(filePath);
            console.log('[EDITOR] Disk content length after save:', (diskContentResult && diskContentResult.length) || 'unknown');
            if (diskContentResult && typeof diskContentResult === 'string') {
              console.log('[EDITOR] Disk content preview (first 200 chars):', diskContentResult.slice(0, 200));
            }
          } catch (readErr) {
            console.log('[EDITOR] Error reading file back after save:', readErr);
          }
        } else {
          console.log('[EDITOR] Save failed:', result?.error);
          dispatch(showStatusRedux('Failed to save file: ' + (result?.error || 'Unknown error')));
        }
      } catch (error) {
        console.log('[EDITOR] Save error:', error);
        dispatch(showStatusRedux('Error saving file: ' + error.message));
      }
    } else {
      console.log('[EDITOR] No currentFilePath, calling Save As');
      await handleSaveAs();
    }
  };

  const handleSaveAs = async () => {
    if (!window.electronAPI) return;
    
    console.log('[EDITOR] handleSaveAs called');
    // CRITICAL: Get content from the correct source based on current view mode
    let textContent;
    if (viewMode === 'array') {
      textContent = getTextFromLines();
    } else if (viewMode === 'monaco') {
      textContent = monacoRef.current?.getValue() ?? content ?? '';
    } else {
      textContent = textareaRef.current?.value ?? content ?? '';
    }
    try {
      const result = await window.electronAPI.saveFileAs(textContent);
      console.log('[EDITOR] Save As result:', result);
      if (result && result.success) {
        console.log('[EDITOR] Updated file path to:', result.filePath);
        // CRITICAL: Update filePathRef immediately so subsequent Ctrl+S uses correct path
        filePathRef.current = result.filePath;
        // Dispatch to Redux: Update global file path and clear modified flag
        dispatch(setCurrentFilePath(result.filePath));
        dispatch(setIsModified(false));
        localStorage.setItem('lastOpenedFile', result.filePath);
        showStatus('File saved successfully');
        window.isModified = false;
      } else if (result && result.error) {
        console.log('[EDITOR] Save As error:', result.error);
        showStatus('Failed to save file: ' + result.error);
      }
    } catch (error) {
      console.log('[EDITOR] Save As exception:', error);
      showStatus('Error saving file: ' + error.message);
    }
  };

  // Get current content from any view mode
  const getCurrentContent = () => {
    if (viewMode === 'array') {
      return getTextFromLines();
    } else if (viewMode === 'monaco') {
      return monacoRef.current?.getValue() ?? content ?? '';
    } else {
      return textareaRef.current?.value ?? content ?? '';
    }
  };

  // Switch to a specific view mode
  const switchToViewMode = (newMode, skipLocalStorage = false) => {
    if (newMode === viewMode) return;
    
    console.log('[EDITOR] switchToViewMode:', viewMode, '->', newMode);
    
    // Get current content before switching
    const currentContent = getCurrentContent();
    setContent(currentContent);
    
    // If switching to array view, parse the content
    if (newMode === 'array') {
      parseText(currentContent);
      renderEditor();
    }
    
    setViewMode(newMode);
    // Only update localStorage if not triggered by localStorage change
    if (!skipLocalStorage) {
      localStorage.setItem('editorViewMode', newMode);
    }
  };

  // Cycle through view modes: array -> monaco -> textarea -> array
  const cycleViewMode = () => {
    const modes = ['array', 'monaco', 'textarea'];
    const currentIndex = modes.indexOf(viewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    switchToViewMode(modes[nextIndex]);
  };

  const foldAll = () => {
    // CRITICAL: Check view mode FIRST - early return pattern (Common Issues 1d)
    if (viewMode === 'monaco') {
      // Monaco has native fold - no need to manipulate lines array
      if (monacoRef.current && window.monaco) {
        try {
          const action = monacoRef.current.getAction('editor.foldAll');
          action && action.run();
        } catch (e) {
          console.warn('[EDITOR] Monaco foldAll action failed:', e);
        }
      }
      return; // Early return - don't do array operations for Monaco
    }
    
    // Array view: manipulate lines array
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
    // Dispatch to Redux: Mark as modified
    dispatch(setIsModified(true));
  };

  const unfoldAll = () => {
    // CRITICAL: Check view mode FIRST - early return pattern (Common Issues 1d)
    if (viewMode === 'monaco') {
      // Monaco has native unfold - no need to manipulate lines array
      if (monacoRef.current && window.monaco) {
        try {
          const action = monacoRef.current.getAction('editor.unfoldAll');
          action && action.run();
        } catch (e) {
          console.warn('[EDITOR] Monaco unfoldAll action failed:', e);
        }
      }
      return; // Early return - don't do array operations for Monaco
    }
    
    // Array view: manipulate lines array
    const lines = getLines();
    lines.forEach(line => {
      if (line.startIdx !== -1) {
        line.open = true;
        line.text = line.text.replace(/#folded\b/gi, '').trim();
      }
    });
    renderEditor();
    // Dispatch to Redux: Mark as modified
    dispatch(setIsModified(true));
  };

  const renderEditor = () => {
    setRenderTrigger(prev => prev + 1);
  };

  // REMOVED: All ref assignments - no longer needed without Electron native menu

  const getVisibleLines = () => {
    const lines = getLines();
    
    // Recalculate fold ranges to include proposed lines
    recalculateFoldRanges(lines);
    
    const visible = [];
    let currentDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      
      if (isLineHidden(i)) continue;
      
      let displayDepth = currentDepth;
      
      // Update nesting context
      if (l.startIdx !== -1 && l.endIdx !== -1) {
        if (l.level === 1) {
          displayDepth = 0;
          currentDepth = 1;
        } else if (l.level === 2) {
          displayDepth = 1;
          currentDepth = 2;
        }
      }
      
      visible.push({ line: l, index: i, displayDepth });
    }
    
    return visible;
  };

  const recalculateFoldRanges = (lines) => {
    // Recalculate endIdx for all sections to include newly added lines
    const stack = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const text = line.text.trim();
      const isHeader = text.match(/^#chapter(?:\s|$)/i) || text.match(/^#section(?:\s|$)/i);
      
      if (isHeader) {
        const level = text.match(/^#chapter(?:\s|$)/i) ? 1 : 2;
        
        // Close previous sections of same or higher level
        while (stack.length && stack[stack.length - 1].level >= level) {
          const prev = stack.pop();
          lines[prev.idx].endIdx = Math.max(prev.idx, i - 1);
        }
        
        lines[i].startIdx = i;
        stack.push({ idx: i, level });
      } else if (text.match(/^#chapterend$/i)) {
        while (stack.length) {
          const prev = stack.pop();
          if (lines[prev.idx].level === 1) {
            lines[prev.idx].endIdx = i;
            break;
          }
        }
      } else if (text.match(/^#sectionend$/i)) {
        while (stack.length) {
          const prev = stack.pop();
          if (lines[prev.idx].level === 2) {
            lines[prev.idx].endIdx = i;
            break;
          }
        }
      }
    }
    
    // Close remaining open sections
    while (stack.length) {
      const prev = stack.pop();
      lines[prev.idx].endIdx = lines.length - 1;
    }
  };

  const renderLine = (lineIndex, displayDepth) => {
    const l = getLines()[lineIndex];
    const i = lineIndex;
    
    // Determine CSS classes based on proposed change type
    let editorLineClasses = `editor-line ${isArrayView ? 'array-view-line' : ''}`;
    if (l.proposedChangeType === 'insert') {
      editorLineClasses += ` diff-line-insert`;
    } else if (l.proposedChangeType === 'delete') {
      editorLineClasses += ` diff-line-delete`;
    } else if (l.proposedChangeType === 'modify') {
      editorLineClasses += ` diff-line-modify`; // Special styling for stacked original/proposed
    }
    
    let html = '';
    
    if (isArrayView) {
      html = `<div class="array-line-container" data-level="${l.level}">`;
      html += `<div class="array-index-gutter">${i}:</div>`;
    }
    
    const depthClass = isArrayView ? `nesting-depth-${displayDepth}` : '';
    html += `<div class="${editorLineClasses} ${depthClass}" data-idx="${i}" data-level="${l.level}"`;
    if (l.proposedChangeId) {
      html += ` data-change-id="${l.proposedChangeId}"`;
    }
    html += `>`;
    
    if (isArrayView) {
      html += `<div class="array-id-box">${l.id}:</div>`;
    }
    
    if (l.startIdx !== -1 && l.endIdx !== -1 && l.endIdx >= l.startIdx) {
      const sym = l.open ? '−' : '+';
      const aiClass = isAIEnabled
        ? (l.sendToAI === 'all' ? 'ai-full' : (l.sendToAI === 'title' ? 'ai-partial' : 'ai-none'))
        : '';
      html += `<button class="fold-btn ${aiClass}" data-idx="${i}">${sym}</button>`;
    } else {
      html += `<span class="fold-spacer"></span>`;
    }
    
    // Render line content based on change type
    if (l.proposedChangeType === 'modify') {
      // Show ORIGINAL text (modifyFrom) in red box
      html += `<div class="line-content diff-line-delete" contenteditable="true" spellcheck="true" data-idx="${i}">`;
      html += escapeHtml(l.modifyFrom);
      html += `</div>`;

      // Show PROPOSED text (modifyTo) in green box directly below (not editable)
      html += `<div class="line-content diff-line-insert" contenteditable="false" data-idx="${i}">`;
      html += escapeHtml(l.modifyTo || l.text || '');
      html += `</div>`;
    } else if (l.proposedChangeType === 'insert') {
      // Show INSERTED text (not editable)
      html += `<div class="line-content" contenteditable="false">`;
      html += escapeHtml(l.text);
      html += `</div>`;
    } else if (l.proposedChangeType === 'delete') {
      // Show text to be deleted
      html += `<div class="line-content" contenteditable="true" spellcheck="true" data-idx="${i}">`;
      html += escapeHtml(l.text);
      html += `</div>`;
    } else {
      // Normal line
      html += `<div class="line-content" contenteditable="true" spellcheck="true" data-idx="${i}">`;
      html += escapeHtml(l.text);
      html += `</div>`;
    }
    
    html += `</div>`;
    
    if (isArrayView) {
      html += `</div>`;
    }
    
    return html;
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const addEventListeners = () => {
    const foldButtons = editorRef.current?.querySelectorAll('.fold-btn');
    foldButtons?.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.idx);
        toggleFold(idx);
      };
      
      // Right-click for AI context menu
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.idx);
        showAIContextMenu(e.clientX, e.clientY, idx);
      };
    });
    
    const lineContents = editorRef.current?.querySelectorAll('.line-content');
    lineContents?.forEach(content => {
      content.oninput = (e) => {
        const idx = parseInt(content.dataset.idx);
        handleLineEdit(idx, e.target.textContent);
      };
      
      content.onkeydown = (e) => {
        const idx = parseInt(content.dataset.idx);
        
        if (e.key === 'Enter') {
          e.preventDefault();
          handleEnterKey(idx, content);
        } else if (e.key === 'Backspace') {
          // Check if cursor is at the start of the line
          const sel = window.getSelection();
          if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const cursorOffset = range.startOffset;
            
            // If at start of line and not the first line, merge with previous
            if (cursorOffset === 0 && idx > 0) {
              e.preventDefault();
              handleBackspaceAtStart(idx, content);
            }
          }
        }
      };
    });
  };

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
    
    // Check if new line was created inside a closed section and auto-expand it
    const newLineIdx = idx + 1;
    for (let j = newLineIdx - 1; j >= 0; j--) {
      const p = lines[j];
      if (p.startIdx !== -1 && p.endIdx >= newLineIdx && !p.open) {
        lines[j].open = true;
        lines[j].text = lines[j].text.replace(/#folded\b/gi, '').trim();
        break;
      }
    }
    
    const currentText2 = getTextFromLines();
    updateLinesFromText(currentText2);
    renderEditor();
    // Dispatch to Redux: Mark as modified
    dispatch(setIsModified(true));
    
    // Focus new line and set cursor at start
    setTimeout(() => {
      const newLine = document.querySelector(`[data-idx="${idx + 1}"].line-content`);
      if (newLine) {
        newLine.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (newLine.firstChild) {
          range.setStart(newLine.firstChild, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 0);
  };

  const handleBackspaceAtStart = (idx, element) => {
    const lines = getLines();
    if (idx === 0) return; // Can't merge first line
    
    const currentText = lines[idx].text;
    const prevText = lines[idx - 1].text;
    const mergePosition = prevText.length;
    const mergedText = prevText + currentText;
    
    // Merge current line into previous line
    lines[idx - 1].text = mergedText;
    
    // Remove current line
    lines.splice(idx, 1);
    
    // Re-parse to detect any headers
    const currentText2 = getTextFromLines();
    updateLinesFromText(currentText2);
    renderEditor();
    // Dispatch to Redux: Mark as modified
    dispatch(setIsModified(true));
    
    // Focus previous line and set cursor at merge position
    setTimeout(() => {
      const prevLine = document.querySelector(`[data-idx="${idx - 1}"].line-content`);
      if (prevLine) {
        prevLine.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (prevLine.firstChild) {
          range.setStart(prevLine.firstChild, Math.min(mergePosition, prevLine.textContent.length));
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }, 0);
  };

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

  const applyAIModeToSections = (lines, rootIdx, mode) => {
    let start = rootIdx;
    let end = lines[rootIdx].endIdx >= 0 ? lines[rootIdx].endIdx : lines.length - 1;

    // Identify the owning chapter for these sections so we can reset it to "share all"
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

    // Reset the chapter to "show everything" so its mode does not restrict sections
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

  // Ensure a #summary pseudo-section exists inside a chapter.
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

    // Check if a #summary line already exists within this chapter
    let hasSummary = false;
    for (let i = start; i <= end && i < total; i++) {
      const t = (textLines[i] || '').trim();
      if (/^#summary(?:\s|$)/i.test(t)) {
        hasSummary = true;
        break;
      }
    }

    if (!hasSummary) {
      // Insert #summary and <summary> immediately after the chapter header line
      textLines.splice(chapterIdx + 1, 0, '#summary', '<summary>');
      const newText = textLines.join('\n');
      updateLinesFromText(newText);
      renderEditor();
      // Dispatch to Redux: Mark as modified
      dispatch(setIsModified(true));
    }

  };

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

  const toggleFold = (idx) => {
    const lines = getLines();
    lines[idx].open = !lines[idx].open;

    // Keep #folded tag on the header line in sync with the open state
    let text = lines[idx].text.replace(/#folded\b/gi, '').trim();
    if (!lines[idx].open) {
      text += ' #folded';
    }
    lines[idx].text = text;

    renderEditor();
    // Dispatch to Redux: Mark as modified
    dispatch(setIsModified(true));
  };

  const handleLineEdit = (idx, newText) => {
    const lines = getLines();
    if (lines[idx]) {
      lines[idx].text = newText;
      // Dispatch to Redux: Mark as modified
      dispatch(setIsModified(true));
    }
  };

  // WHAT: Shows temporary status message to user
  // WHY HERE: Helper to dispatch status message to Redux
  // HOW IT WORKS: Dispatches to statusSlice → StatusBar component displays → auto-clears after 3s
  // REPLACES: Old DOM manipulation (document.getElementById('status').textContent)
  // USAGE: showStatus('File saved successfully') or showStatus('Error: ' + error.message)
  const showStatus = (message) => {
    dispatch(showStatusRedux(message));
  };

  // ======================================================================
  // REMOVED: ~300 lines of find-related functions moved to FindBar component
  // See src/components/FindBar/FindBar.js for all find functionality
  // ======================================================================

  return (
    <>
      {/* FindBar: Only shown for array/textarea views. Monaco has built-in Ctrl+F */}
      {isFindVisible && viewMode !== 'monaco' && (
        <FindBar
          viewMode={viewMode}
          editorRef={editorRef}
          textareaRef={textareaRef}
          renderTrigger={renderTrigger}
          onClose={() => setIsFindVisible(false)}
          isArrayView={isArrayView}
        />
      )}
      {viewMode === 'array' && (
        <FoldEditorView
          editorRef={editorRef}
          visibleLines={getVisibleLines()}
          isArrayView={isArrayView}
          onToggleFold={toggleFold}
          onContentChange={() => dispatch(setIsModified(true))}
          onRenderEditor={renderEditor}
          currentChangeId={allChangeIds[currentChangeIdIndex]}
          onShowAIContextMenu={showAIContextMenu}
          isAIEnabled={isAIEnabled}
        />
      )}
      {viewMode === 'monaco' && (
        <MonacoEditorView
          monacoRef={monacoRef}
          content={content}
          onContentChange={(newContent) => {
            if (newContent !== null) {
              setContent(newContent);
            }
            dispatch(setIsModified(true));
          }}
        />
      )}
      {viewMode === 'textarea' && (
        <TextareaEditorView
          textareaRef={textareaRef}
          content={content}
          onContentChange={(newContent) => {
            setContent(newContent);
            dispatch(setIsModified(true));
          }}
          placeholder="Start typing or use File menu to open a file..."
        />
      )}
    </>
  );
}