import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, memo } from 'react';

import { useSelector, useDispatch } from 'react-redux';
import { 
  selectContent, 
  selectCurrentFilePath,
  selectFoldAllTrigger,
  selectUnfoldAllTrigger,
  setIsModified,
  setCurrentFilePath,
} from '../../store/editorSlice';

import { selectIsAIEnabled, selectDeveloperMode, selectShowArrayLineNumbers } from '../../store/settingsSlice';
import { showStatus } from '../../store/statusSlice';

import { parseText, getTextFromLines, updateLinesFromText, getLines, setLines, recomputeVisibleLines, getVisibleLinesCached } from '../../utils/editorEngine';

import EditorLine from './EditorLine';

import DiffActionButtons from './AI/DiffActionButtons';
import DiffNavigation from './AI/DiffNavigation';
import './EditorArray.css';

/**
 * EditorArray - Line-based fold editor component
 * 
 * A contenteditable line-by-line editor with:
 * - Collapsible #chapter and #section folding
 * - Array view with line indexes and IDs
 * - AI proposal diff highlighting
 * - Find functionality (Ctrl+F)
 * - Integration with editorEngine for state management
 */
const EditorArray = forwardRef((props, ref) => {
  const dispatch = useDispatch();
  
  // Redux selectors
  const content = useSelector(selectContent);
  const currentFilePath = useSelector(selectCurrentFilePath);

  const isAIEnabled = useSelector(selectIsAIEnabled);
  const developerMode = useSelector(selectDeveloperMode);
  const showArrayLineNumbers = useSelector(selectShowArrayLineNumbers);
  const foldAllTrigger = useSelector(selectFoldAllTrigger);
  const unfoldAllTrigger = useSelector(selectUnfoldAllTrigger);

  // AI changes from aiChangesSlice (for array editor)
  const { allChangeIds, currentChangeIdIndex, processedChangesByLineID } = useSelector(state => state.aiChanges);
  const currentChangeId = allChangeIds[currentChangeIdIndex] || null;
  
  // Local state
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [isFindVisible, setIsFindVisible] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState([]);
  const [currentFindIndex, setCurrentFindIndex] = useState(-1);

  // EditorArray is always array view (no toggle needed)
  const isArrayView = true;
  
  // Refs
  const editorRef = useRef(null);
  const findInputRef = useRef(null);
  const filePathRef = useRef(currentFilePath);

  // Keep file path ref in sync
  useEffect(() => {
    filePathRef.current = currentFilePath;
  }, [currentFilePath]);

  /**
   * Expose imperative API for parent components (AISidebar)
   *
   * AISidebar uses these to integrate AI responses for the array editor.
   */
  useImperativeHandle(ref, () => ({
    prepareForAI: () => {
      const lines = getLines();
      return lines;
    },
    updateLinesFromAI: (newLines) => {
      setLines(newLines);
      recomputeVisibleLines();
      setRenderTrigger(prev => prev + 1);
    },
    getContent: () => {
      const text = getTextFromLines();
      return text;
    }
  }));

  // Initialize editor when content changes
  useEffect(() => {
    if (content !== undefined) {
      parseText(content);
      recomputeVisibleLines();
      setRenderTrigger(prev => prev + 1);
    }
  }, [content]);

  // Respond to fold all trigger
  useEffect(() => {
    if (!foldAllTrigger) return;
    foldAll();
  }, [foldAllTrigger]);

  // Respond to unfold all trigger
  useEffect(() => {
    if (!unfoldAllTrigger) return;
    unfoldAll();
  }, [unfoldAllTrigger]);

  // Keyboard shortcuts (Find, Escape)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F: Find
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsFindVisible(true);
        setTimeout(() => {
          if (findInputRef.current) {
            findInputRef.current.focus();
            findInputRef.current.select();
          }
        }, 0);
        return;
      }

      // Escape: Close find box
      if (e.key === 'Escape') {
        if (isFindVisible) {
          setIsFindVisible(false);
          clearFindHighlight();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFindVisible]);

  // Auto-highlight current match when index changes
  useEffect(() => {
    if (currentFindIndex >= 0 && findMatches.length > 0) {
      highlightCurrentFindMatch(currentFindIndex);
    }
  }, [currentFindIndex, findMatches]);

  // Re-compute find matches when content changes
  useEffect(() => {
    if (!isFindVisible || !findQuery) {
      clearFindHighlight();
      return;
    }
    recomputeFindMatches(findQuery);
  }, [renderTrigger]);

  /**
   * Fold all collapsible sections
   */
  const foldAll = () => {
    const lines = getLines();

    lines.forEach(line => {
      if (line.level !== 0) {
        line.open = false;
      }
    });
    recomputeVisibleLines();
    setRenderTrigger(prev => prev + 1);
    dispatch(setIsModified(true));
  };

  /**
   * Unfold all sections
   */
  const unfoldAll = () => {
    const lines = getLines();

    lines.forEach(line => {
      if (line.level !== 0) {
        line.open = true;
      }
    });
    recomputeVisibleLines();
    setRenderTrigger(prev => prev + 1);
    dispatch(setIsModified(true));
  };

  /**
   * Toggle fold state for a specific line
   */
  const toggleFold = (idx) => {
    const lines = getLines();

    lines[idx].open = !lines[idx].open;
    recomputeVisibleLines();
    setRenderTrigger(prev => prev + 1);
    dispatch(setIsModified(true));
  };

  /**
   * Handle content change from line edits
   */
  const handleContentChange = () => {
    dispatch(setIsModified(true));
  };

  /**
   * Re-render editor
   */
  const handleRenderEditor = () => {
    setRenderTrigger(prev => prev + 1);
  };

  /**
   * Clear find highlight
   */
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
    clearFindHighlight();

    if (!query) {
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
      let startIndex = 0;
      while ((startIndex = lowerText.indexOf(q, startIndex)) !== -1) {
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

    highlightAllMatches(matches, container);

    setFindMatches(matches);
    if (matches.length > 0) {
      setCurrentFindIndex(0);
    } else {
      setCurrentFindIndex(-1);
    }
  };

  const highlightCurrentFindMatch = (index) => {
    if (findMatches.length === 0 || index < 0 || index >= findMatches.length) {
      return;
    }

    const container = editorRef.current;
    if (!container) return;

    // Reset previous "current" highlight
    container.querySelectorAll('.find-highlight-current').forEach(el => {
      el.classList.remove('find-highlight-current');
      el.classList.add('find-highlight');
    });

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

  const handleFindInputChange = (e) => {
    const value = e.target.value;
    setFindQuery(value);
    
    // Debounce search for better performance
    if (window.findDebounceTimeout) {
      clearTimeout(window.findDebounceTimeout);
    }
    window.findDebounceTimeout = setTimeout(() => {
      recomputeFindMatches(value);
    }, 150);
  };

  const handleFindNext = () => {
    if (findMatches.length === 0) return;
    setCurrentFindIndex(prev => (prev + 1) % findMatches.length);
  };

  const handleFindPrevious = () => {
    if (findMatches.length === 0) return;
    setCurrentFindIndex(prev => prev <= 0 ? findMatches.length - 1 : prev - 1);
  };

  const handleFindClose = () => {
    setIsFindVisible(false);
    clearFindHighlight();
  };

  // Get visible lines for rendering
  const visibleLines = getVisibleLinesCached();

  return (
    <>
      {/* Find Box */}
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

      {/* Editor Display */}
      <div id="editor-display" className="editor-display" ref={editorRef}>
        {visibleLines.map(({ line, index, displayDepth }) => (
          <React.Fragment key={line.id || index}>
            <EditorLine
              line={line}
              lineIndex={index}
              displayDepth={displayDepth}
              isArrayView={isArrayView}
              onToggleFold={toggleFold}
              onContentChange={handleContentChange}
              onRenderEditor={handleRenderEditor}
              currentChangeId={currentChangeId}
              isAIEnabled={isAIEnabled}
              developerMode={developerMode}
              showArrayLineNumbers={showArrayLineNumbers}
            />
            {line.proposedChangeType && (
              <DiffActionButtons
                proposedChangeId={line.proposedChangeId}
                changeType={line.proposedChangeType}
                onUpdate={handleRenderEditor}
                onContentChange={handleContentChange}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Diff Navigation (shown when AI proposals exist) */}
      {allChangeIds && allChangeIds.length > 0 && (
        <DiffNavigation onUpdate={handleRenderEditor} />
      )}
    </>
  );
});

export default memo(EditorArray);