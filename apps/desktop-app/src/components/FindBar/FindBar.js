import React, { useState, useEffect, useRef } from 'react';
import './FindBar.css';

/**
 * FindBar - Find/search UI for array and textarea editor views
 * 
 * PURPOSE:
 * - Provides Ctrl+F find functionality for array and textarea views
 * - NOT used for Monaco view (Monaco has its own built-in Ctrl+F)
 * 
 * WHY SEPARATE COMPONENT:
 * - Extracted from Editor.js to reduce component size
 * - Self-contained find logic (search, highlight, navigation)
 * - Only mounted when needed (not in Monaco mode)
 * 
 * PROPS:
 * - viewMode: 'array' | 'textarea' (Monaco handled separately)
 * - editorRef: Ref to array view container (for DOM search)
 * - textareaRef: Ref to textarea element (for text search)
 * - renderTrigger: Increments when content changes (triggers re-search)
 * - onClose: Callback when find bar is closed
 * 
 * STATE:
 * - findQuery: Current search text
 * - findMatches: Array of found matches with positions
 * - currentFindIndex: Index of currently highlighted match
 */
function FindBar({ 
  viewMode, 
  editorRef, 
  textareaRef, 
  renderTrigger, 
  onClose,
  isArrayView = true 
}) {
  const [findQuery, setFindQuery] = useState('');
  const [findMatches, setFindMatches] = useState([]);
  const [currentFindIndex, setCurrentFindIndex] = useState(-1);
  const findInputRef = useRef(null);

  // Auto-focus input when component mounts
  useEffect(() => {
    if (findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, []);

  // Clear highlights on unmount
  useEffect(() => {
    return () => clearFindHighlight();
  }, []);

  // WHAT: Removes all find highlight spans from DOM
  // WHY: Cleanup before new search or when closing find
  // HOW: Replaces <span class="find-highlight"> with plain text nodes
  const clearFindHighlight = () => {
    if (viewMode !== 'array') return;
    
    const container = editorRef?.current;
    if (!container) return;

    const highlights = container.querySelectorAll('.find-highlight, .find-highlight-current');
    highlights.forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  };

  // WHAT: Searches for query in current view and stores matches
  // WHY: Debounced in array view (expensive DOM search), immediate in textarea
  // HOW: Different search strategy per view mode
  const recomputeFindMatches = (query) => {
    // Always clear previous highlights
    clearFindHighlight();

    if (!query) {
      setFindMatches([]);
      setCurrentFindIndex(-1);
      return;
    }

    // Textarea view: Fast string search
    if (viewMode === 'textarea') {
      if (!textareaRef?.current) {
        setFindMatches([]);
        setCurrentFindIndex(-1);
        return;
      }

      const text = textareaRef.current.value || '';
      const lowerText = text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const matches = [];
      
      let startIndex = 0;
      while ((startIndex = lowerText.indexOf(lowerQuery, startIndex)) !== -1) {
        matches.push({
          startIndex,
          endIndex: startIndex + query.length
        });
        startIndex += query.length;
      }

      setFindMatches(matches);
      setCurrentFindIndex(matches.length > 0 ? 0 : -1);
      return;
    }

    // Array view: DOM element search with highlighting
    const container = editorRef?.current;
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

    // Highlight all matches in DOM
    highlightAllMatches(matches, container);

    setFindMatches(matches);
    setCurrentFindIndex(matches.length > 0 ? 0 : -1);
  };

  // WHAT: Highlights current match in view
  // WHY: Shows user which result they're on
  // HOW: Different strategy per view (selection in textarea, CSS class in array)
  const highlightCurrentFindMatch = (index) => {
    if (findMatches.length === 0 || index < 0 || index >= findMatches.length) {
      return;
    }

    // Textarea: Use browser selection
    if (viewMode === 'textarea') {
      if (!textareaRef?.current) return;
      const match = findMatches[index];
      
      const shouldFocus = document.activeElement !== findInputRef.current;
      if (shouldFocus) {
        textareaRef.current.focus();
      }
      
      textareaRef.current.setSelectionRange(match.startIndex, match.endIndex);
      
      // Scroll to match
      requestAnimationFrame(() => {
        if (!textareaRef?.current) return;
        const text = textareaRef.current.value.substring(0, match.startIndex);
        const lineNumber = (text.match(/\n/g) || []).length;
        const lineHeight = parseFloat(getComputedStyle(textareaRef.current).lineHeight) || 28.8;
        const matchTopPosition = lineNumber * lineHeight;
        const viewportHeight = textareaRef.current.clientHeight;
        const scrollPosition = matchTopPosition - (viewportHeight / 2) + (lineHeight / 2);
        textareaRef.current.scrollTop = Math.max(0, scrollPosition);
      });
      return;
    }

    // Array view: CSS highlight + scroll
    const container = editorRef?.current;
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

  // WHAT: Wraps matches in <span> elements for visual highlighting
  // WHY: CSS can style the spans (yellow background, orange for current)
  // HOW: Splits text into fragments, wraps matches in spans, rebuilds DOM
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

  // Re-compute matches when content changes (renderTrigger increments)
  useEffect(() => {
    if (!findQuery) {
      clearFindHighlight();
      return;
    }
    recomputeFindMatches(findQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderTrigger]);

  // Highlight current match when index changes
  useEffect(() => {
    if (findMatches.length === 0) {
      clearFindHighlight();
      return;
    }
    if (currentFindIndex >= 0 && currentFindIndex < findMatches.length) {
      highlightCurrentFindMatch(currentFindIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFindIndex, findMatches]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setFindQuery(value);
    
    // Debounce search in array view (expensive DOM operation)
    if (viewMode === 'array') {
      if (window.findDebounceTimeout) {
        clearTimeout(window.findDebounceTimeout);
      }
      window.findDebounceTimeout = setTimeout(() => {
        recomputeFindMatches(value);
      }, 150);
    } else {
      // Textarea: search immediately (fast)
      recomputeFindMatches(value);
    }
  };

  const handleNext = () => {
    if (findMatches.length === 0) return;
    setCurrentFindIndex(prev => {
      const next = prev + 1;
      return next >= findMatches.length ? 0 : next;
    });
  };

  const handlePrevious = () => {
    if (findMatches.length === 0) return;
    setCurrentFindIndex(prev => {
      const next = prev - 1;
      return next < 0 ? findMatches.length - 1 : next;
    });
  };

  const handleClose = () => {
    clearFindHighlight();
    onClose();
  };

  return (
    <div className="find-box">
      <input
        ref={findInputRef}
        type="text"
        className="find-input"
        value={findQuery}
        onChange={handleInputChange}
        placeholder="Find..."
      />
      <div className="find-counter">
        {findMatches.length === 0
          ? 'No results'
          : `${currentFindIndex + 1} of ${findMatches.length}`}
      </div>
      <button
        className="find-btn"
        onClick={handlePrevious}
        disabled={findMatches.length === 0}
        title="Previous (Shift+Enter)"
      >
        ↑
      </button>
      <button
        className="find-btn"
        onClick={handleNext}
        disabled={findMatches.length === 0}
        title="Next (Enter)"
      >
        ↓
      </button>
      <button
        className="find-btn find-close-btn"
        onClick={handleClose}
        title="Close (Esc)"
      >
        ×
      </button>
    </div>
  );
}

export default FindBar;
