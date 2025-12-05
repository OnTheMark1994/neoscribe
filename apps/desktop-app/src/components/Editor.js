import React, { useState, useEffect, useRef, memo } from 'react';
import { useSelector } from 'react-redux';
import { parseText, getTextFromLines, updateLinesFromText, getLines } from '../utils/editorEngine';
import EditorLine from './EditorLine';
import DiffActionButtons from './DiffActionButtons';
import './Editor.css';

function Editor({ currentFilePath, onFileChange, onContentChange, onSaveComplete, onEditorReady, isAIEnabled }) {
  const [content, setContent] = useState('');
  const [isFoldView, setIsFoldView] = useState(true);
  const [isArrayView, setIsArrayView] = useState(true);
  const [renderTrigger, setRenderTrigger] = useState(0);
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const menuListenersSetupRef = useRef(false);
  const openDialogActiveRef = useRef(false);
  // Keep latest file path in a ref so menu callbacks always see the current value
  const filePathRef = useRef(currentFilePath || null);
  const { currentChangeIdIndex, allChangeIds } = useSelector(state => state.aiChanges);
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState([]);
  const [currentFindIndex, setCurrentFindIndex] = useState(-1);
  const findInputRef = useRef(null);

  // Expose updateLinesFromAI method to parent
  useEffect(() => {
    if (onEditorReady) {
      onEditorReady({
        updateLinesFromAI: (newLines) => {
          // Replace lines in editorEngine
          const { setLines } = require('../utils/editorEngine');
          setLines(newLines);
          setRenderTrigger(prev => prev + 1); // Trigger re-render
        }
      });
    }
  }, [onEditorReady]);

  useEffect(() => {
    // Initialize editor
    parseText('');
    renderEditor();

    // Load last opened file
    const lastFile = localStorage.getItem('lastOpenedFile');
    if (lastFile && window.electronAPI && window.electronAPI.openEncryptedFileWithPath) {
      window.electronAPI.openEncryptedFileWithPath(lastFile).then(result => {
        if (result && result.success) {
          console.log('[EDITOR] Loaded last file:', result.filePath);
          setContent(result.content);
          onFileChange(result.filePath);
          parseText(result.content);
          renderEditor();
        } else {
          console.log('[EDITOR] Failed to load last file');
        }
      }).catch(err => {
        console.log('Could not load last file:', err);
        localStorage.removeItem('lastOpenedFile');
      });
    }

    // Set up menu listeners - use ref to prevent multiple registrations
    if (window.electronAPI && !menuListenersSetupRef.current) {
      window.electronAPI.onMenuNew(() => handleNew());
      window.electronAPI.onMenuOpen(() => handleOpen());
      window.electronAPI.onMenuSave(() => handleSave());
      window.electronAPI.onMenuSaveAs(() => handleSaveAs());
      window.electronAPI.onToggleFoldView && window.electronAPI.onToggleFoldView(() => toggleFoldView());
      window.electronAPI.onFoldAll(() => foldAll());
      window.electronAPI.onUnfoldAll(() => unfoldAll());
      
      menuListenersSetupRef.current = true;
    }

    // Hide loading screen
    setTimeout(() => {
      const loadingScreen = document.getElementById('loadingScreen');
      if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        setTimeout(() => {
          loadingScreen.style.display = 'none';
        }, 300);
      }
    }, 100);
  }, []);

  // Listen for native AI context menu choices from Electron
  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onAIContextChoice) return;

    const handler = (data) => {
      if (!data) return;
      const { lineIdx, action, scope, option } = data;
      const lines = getLines();

      if (typeof lineIdx !== 'number' || !lines[lineIdx]) return;

      // Fold/unfold toggle from native menu
      if (action === 'foldToggle') {
        toggleFold(lineIdx);
        return;
      }

      if (option) {
        if (scope === 'sections' && (lines[lineIdx].level === 1 || lines[lineIdx].level === 2)) {
          applyAIModeToSections(lines, lineIdx, option);
        } else {
          // When setting a chapter to Summary mode, ensure it has a #summary block
          if (option === 'summary' && lines[lineIdx].level === 1) {
            ensureChapterSummarySection(lineIdx);
          }
          applyAIModeToLine(lines, lineIdx, option);
        }
        renderEditor();
        onContentChange();
      }
    };

    window.electronAPI.onAIContextChoice(handler);
  }, [onContentChange]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsFindVisible(true);
        setTimeout(() => {
          if (findInputRef.current) {
            findInputRef.current.focus();
            findInputRef.current.select();
          }
        }, 0);
      } else if (e.key === 'Escape') {
        if (isFindVisible) {
          setIsFindVisible(false);
          clearFindHighlight();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFindVisible]);

  // Keep ref in sync with prop so async callbacks always see latest file path
  useEffect(() => {
    filePathRef.current = currentFilePath || null;
  }, [currentFilePath]);

  const handleNew = () => {
    if (window.isModified) {
      if (window.confirm('You have unsaved changes. Continue?')) {
        setContent('');
        parseText('');
        renderEditor();
        onFileChange(null);
      }
    } else {
      setContent('');
      parseText('');
      renderEditor();
      onFileChange(null);
    }
  };

  const handleOpen = async () => {
    if (!window.electronAPI) return;
    
    // Guard against duplicate open dialogs (e.g. if menu-open fires twice)
    if (openDialogActiveRef.current) {
      console.log('[EDITOR] Open dialog already active, ignoring duplicate menu-open');
      return;
    }

    openDialogActiveRef.current = true;

    const result = await window.electronAPI.openEncryptedFile();

    openDialogActiveRef.current = false;
    if (result && result.success) {
      setContent(result.content);
      onFileChange(result.filePath);
      parseText(result.content);
      renderEditor();
      localStorage.setItem('lastOpenedFile', result.filePath);
    }
  };

  const handleSave = async () => {
    if (!window.electronAPI) return;
    
    const filePath = filePathRef.current;
    console.log('[EDITOR] handleSave called, filePathRef.current:', filePath);
    
    const textContent = getTextFromLines();
    console.log('[EDITOR] Text content length:', textContent.length);

    if (filePath) {
      console.log('[EDITOR] Saving to existing file:', filePath);
      console.log('[EDITOR] Text content length:', textContent.length);
      try {
        const result = await window.electronAPI.saveFile(filePath, textContent);
        if (result && result.success) {
          console.log('[EDITOR] File saved successfully');
          showStatus('File saved successfully');
          window.isModified = false;
          onSaveComplete && onSaveComplete();

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
          showStatus('Failed to save file: ' + (result?.error || 'Unknown error'));
        }
      } catch (error) {
        console.log('[EDITOR] Save error:', error);
        showStatus('Error saving file: ' + error.message);
      }
    } else {
      console.log('[EDITOR] No currentFilePath, calling Save As');
      await handleSaveAs();
    }
  };

  const handleSaveAs = async () => {
    if (!window.electronAPI) return;
    
    console.log('[EDITOR] handleSaveAs called');
    const textContent = getTextFromLines();
    try {
      const result = await window.electronAPI.saveFileAs(textContent);
      console.log('[EDITOR] Save As result:', result);
      if (result && result.success) {
        console.log('[EDITOR] Calling onFileChange with:', result.filePath);
        onFileChange(result.filePath);
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

  // Sync helpers between fold/lines model and textarea text
  const syncFoldLinesToTextarea = () => {
    const textContent = getTextFromLines();
    setContent(textContent);
    if (textareaRef.current) {
      textareaRef.current.value = textContent;
    }
  };

  const syncTextareaToFoldLines = () => {
    const textContent = textareaRef.current?.value ?? content ?? '';
    parseText(textContent);
    renderEditor();
  };

  const toggleFoldView = () => {
    console.log("toggleFoldView");
    setIsFoldView(prevIsFoldView => {
      const nextIsFoldView = !prevIsFoldView;

      if (nextIsFoldView) {
        // Switching from plain textarea into fold view: parse latest textarea text
        syncTextareaToFoldLines();
      } else {
        // Switching from fold view into plain textarea: materialize latest lines into text
        syncFoldLinesToTextarea();
      }

      return nextIsFoldView;
    });
  };

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
    onContentChange();
  };

  const unfoldAll = () => {
    const lines = getLines();
    lines.forEach(line => {
      if (line.startIdx !== -1) {
        line.open = true;
        line.text = line.text.replace(/#folded\b/gi, '').trim();
      }
    });
    renderEditor();
    onContentChange();
  };

  const renderEditor = () => {
    setRenderTrigger(prev => prev + 1);
  };

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
    onContentChange();
    
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
    onContentChange();
    
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
      onContentChange();
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
      return;
    }
    // If no Electron bridge is available, do nothing (DOM menu is disabled in favor of native OS menu).
  };

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
    onContentChange();
  };

  const handleLineEdit = (idx, newText) => {
    const lines = getLines();
    if (lines[idx]) {
      lines[idx].text = newText;
      onContentChange();
    }
  };

  const showStatus = (message) => {
    const statusBar = document.getElementById('status');
    if (statusBar) {
      statusBar.textContent = message;
      setTimeout(() => {
        statusBar.textContent = '';
      }, 3000);
    }
  };

  const clearFindHighlight = () => {
    const container = editorRef.current;
    if (!container) return;

    const highlights = container.querySelectorAll('.find-highlight, .find-highlight-current');
    highlights.forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  };

  const recomputeFindMatches = (query) => {
    // Always start by clearing previous highlights so we work from plain text
    clearFindHighlight();

    if (!isFoldView || !query) {
      setFindMatches([]);
      setCurrentFindIndex(-1);
      return;
    }

    const container = editorRef.current;
    if (!container) {
      setFindMatches([]);
      setCurrentFindIndex(-1);
      return;
    }

    const q = query.toLowerCase();
    const matches = [];

    const lineContents = container.querySelectorAll('.line-content');
    lineContents.forEach((lineContent, index) => {
      const lineElement = lineContent.closest('.editor-line');
      const lineIndex = parseInt(lineElement?.getAttribute('data-idx'), 10) || index;

      searchInElement(lineContent, lineIndex, 'content');

      if (isArrayView) {
        const lineContainer = lineContent.closest('.array-line-container');
        if (lineContainer) {
          const gutter = lineContainer.querySelector('.array-index-gutter');
          const idBox = lineContainer.querySelector('.array-id-box');
          if (gutter) searchInElement(gutter, lineIndex, 'line-number');
          if (idBox) searchInElement(idBox, lineIndex, 'id');
        }
      }
    });

    function searchInElement(element, lineIndex, type) {
      const text = element.textContent || '';
      const lowerText = text.toLowerCase();
      const lowerQuery = q;
      let startIndex = 0;
      while ((startIndex = lowerText.indexOf(lowerQuery, startIndex)) !== -1) {
        matches.push({
          element,
          lineIndex,
          startIndex,
          endIndex: startIndex + query.length,
          type
        });
        startIndex += query.length;
      }
    }

    // Highlight all matches by wrapping them in span elements
    highlightAllMatches(matches, container);

    setFindMatches(matches);
    if (matches.length > 0) {
      setCurrentFindIndex(0);
    } else {
      setCurrentFindIndex(-1);
    }
  };

  const highlightCurrentFindMatch = (index) => {
    const container = editorRef.current;
    if (!container) return;

    // Reset previous "current" highlight
    container.querySelectorAll('.find-highlight-current').forEach(el => {
      el.classList.remove('find-highlight-current');
      el.classList.add('find-highlight');
    });

    if (!isFoldView || findMatches.length === 0 || index < 0 || index >= findMatches.length) {
      return;
    }

    const highlight = container.querySelector(`[data-find-index="${index}"]`);
    if (highlight) {
      highlight.classList.remove('find-highlight');
      highlight.classList.add('find-highlight-current');
      const containerEl = highlight.closest('.array-line-container, .editor-line') || highlight;
      containerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const highlightAllMatches = (matches, container) => {
    const matchesByElement = new Map();

    matches.forEach((match, index) => {
      if (!matchesByElement.has(match.element)) {
        matchesByElement.set(match.element, []);
      }
      matchesByElement.get(match.element).push({ ...match, globalIndex: index });
    });

    matchesByElement.forEach((elementMatches, element) => {
      if (!container.contains(element)) return;

      const text = element.textContent || '';
      const fragments = [];
      let lastIndex = 0;

      elementMatches.sort((a, b) => a.startIndex - b.startIndex);

      elementMatches.forEach(match => {
        if (match.startIndex > lastIndex) {
          fragments.push(document.createTextNode(text.substring(lastIndex, match.startIndex)));
        }

        const highlight = document.createElement('span');
        highlight.className = 'find-highlight';
        highlight.textContent = text.substring(match.startIndex, match.endIndex);
        highlight.dataset.findIndex = match.globalIndex;
        if (match.type) {
          highlight.classList.add(`find-${match.type}`);
        }

        fragments.push(highlight);
        lastIndex = match.endIndex;
      });

      if (lastIndex < text.length) {
        fragments.push(document.createTextNode(text.substring(lastIndex)));
      }

      element.innerHTML = '';
      fragments.forEach(fragment => element.appendChild(fragment));
    });
  };

  useEffect(() => {
    if (!isFindVisible || !findQuery) {
      clearFindHighlight();
      return;
    }
    recomputeFindMatches(findQuery);
    // We intentionally depend only on renderTrigger so eslint warning is acceptable here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTrigger]);

  useEffect(() => {
    if (!isFindVisible || findMatches.length === 0) {
      clearFindHighlight();
      return;
    }
    if (currentFindIndex >= 0 && currentFindIndex < findMatches.length) {
      highlightCurrentFindMatch(currentFindIndex);
    }
  }, [currentFindIndex, findMatches, isFindVisible]);

  const handleFindInputChange = (e) => {
    const value = e.target.value;
    setFindQuery(value);
    recomputeFindMatches(value);
  };

  const handleFindNext = () => {
    if (findMatches.length === 0) return;
    setCurrentFindIndex(prev => {
      let next = prev + 1;
      if (next >= findMatches.length) {
        next = 0;
      }
      // Always scroll to the computed match, even if index value doesn't change
      highlightCurrentFindMatch(next);
      return next;
    });
  };

  const handleFindPrevious = () => {
    if (findMatches.length === 0) return;
    setCurrentFindIndex(prev => {
      let next = prev - 1;
      if (next < 0) {
        next = findMatches.length - 1;
      }
      // Always scroll to the computed match, even if index value doesn't change
      highlightCurrentFindMatch(next);
      return next;
    });
  };

  const handleFindClose = () => {
    setIsFindVisible(false);
    clearFindHighlight();
  };

  return (
    <>
      {isFoldView ? (
        <>
          {isFindVisible && (
            <div className="find-box">
              <input
                ref={findInputRef}
                type="text"
                className="find-input"
                value={findQuery}
                onChange={handleFindInputChange}
                placeholder="Find..."
              />
              <div className="find-counter">
                {findMatches.length === 0
                  ? 'No results'
                  : `${currentFindIndex + 1} of ${findMatches.length}`}
              </div>
              <button
                className="find-btn"
                onClick={handleFindPrevious}
                disabled={findMatches.length === 0}
              >
                ↑
              </button>
              <button
                className="find-btn"
                onClick={handleFindNext}
                disabled={findMatches.length === 0}
              >
                ↓
              </button>
              <button
                className="find-btn find-close-btn"
                onClick={handleFindClose}
              >
                ×
              </button>
            </div>
          )}
          <div id="editor-display" className="editor-display" ref={editorRef}>
            {getVisibleLines().map(({ line, index, displayDepth }) => (
              <React.Fragment key={line.id || index}>
                <EditorLine
                  line={line}
                  lineIndex={index}
                  displayDepth={displayDepth}
                  isArrayView={isArrayView}
                  onToggleFold={toggleFold}
                  onContentChange={onContentChange}
                  onRenderEditor={renderEditor}
                  currentChangeId={allChangeIds[currentChangeIdIndex]}
                  onShowAIContextMenu={showAIContextMenu}
                  isAIEnabled={isAIEnabled}
                />
                {line.proposedChangeType && (
                  <DiffActionButtons
                    proposedChangeId={line.proposedChangeId}
                    changeType={line.proposedChangeType}
                    onUpdate={renderEditor}
                    onContentChange={onContentChange}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </>
      ) : (
        <textarea
          ref={textareaRef}
          id="editor"
          className="editor-textarea"
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            onContentChange();
          }}
          placeholder="Start typing or use File menu to open a file..."
          spellCheck={true}
        />
      )}
    </>
  );
}

export default memo(Editor);
