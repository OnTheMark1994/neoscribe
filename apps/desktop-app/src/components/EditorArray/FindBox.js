import React, { useState, useRef, useEffect, useCallback } from 'react';
import './FindBox.css';

/**
 * FindBox - Find functionality for EditorArray
 * 
 * Manages find input, match highlighting, and navigation.
 * Uses a callback to get the editor container element for searching.
 */
function FindBox({ visible, onClose, getEditorContainer }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const inputRef = useRef(null);

  // Focus input when visible
  useEffect(() => {
    if (visible && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [visible]);

  // Clear highlights when closing
  useEffect(() => {
    if (!visible) {
      clearHighlights();
      setQuery('');
      setMatches([]);
      setCurrentIndex(-1);
    }
  }, [visible]);

  const clearHighlights = useCallback(() => {
    const container = getEditorContainer?.();
    if (!container) return;
    
    container.querySelectorAll('.find-highlight, .find-highlight-current').forEach(el => {
      const parent = el.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }, [getEditorContainer]);

  const performSearch = useCallback((searchQuery) => {
    clearHighlights();

    if (!searchQuery) {
      setMatches([]);
      setCurrentIndex(-1);
      return;
    }

    const container = getEditorContainer?.();
    if (!container) {
      setMatches([]);
      setCurrentIndex(-1);
      return;
    }

    const q = searchQuery.toLowerCase();
    const foundMatches = [];

    const lineContents = container.querySelectorAll('.line-content');
    lineContents.forEach((lineContent, index) => {
      const lineElement = lineContent.closest('.editor-line');
      const lineIndex = parseInt(lineElement?.getAttribute('data-idx'), 10) || index;

      searchInElement(lineContent, lineIndex, 'content');

      const lineContainer = lineContent.closest('.array-line-container');
      if (lineContainer) {
        const gutter = lineContainer.querySelector('.array-index-gutter');
        const idBox = lineContainer.querySelector('.array-id-box');
        if (gutter) searchInElement(gutter, lineIndex, 'line-number');
        if (idBox) searchInElement(idBox, lineIndex, 'id');
      }
    });

    function searchInElement(element, lineIndex, type) {
      const text = element.textContent || '';
      const lowerText = text.toLowerCase();
      let startIdx = 0;
      while ((startIdx = lowerText.indexOf(q, startIdx)) !== -1) {
        foundMatches.push({
          element,
          lineIndex,
          startIndex: startIdx,
          endIndex: startIdx + searchQuery.length,
          type
        });
        startIdx += searchQuery.length;
      }
    }

    highlightAllMatches(foundMatches, container);
    setMatches(foundMatches);
    
    if (foundMatches.length > 0) {
      setCurrentIndex(0);
      highlightCurrent(0, foundMatches, container);
    } else {
      setCurrentIndex(-1);
    }
  }, [clearHighlights, getEditorContainer]);

  const highlightAllMatches = (matchList, container) => {
    const matchesByElement = new Map();

    matchList.forEach((match, index) => {
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

  const highlightCurrent = (index, matchList, container) => {
    if (matchList.length === 0 || index < 0 || index >= matchList.length) return;

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

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    
    // Debounce search
    if (window.findDebounceTimeout) {
      clearTimeout(window.findDebounceTimeout);
    }
    window.findDebounceTimeout = setTimeout(() => {
      performSearch(value);
    }, 150);
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    const newIndex = (currentIndex + 1) % matches.length;
    setCurrentIndex(newIndex);
    const container = getEditorContainer?.();
    if (container) highlightCurrent(newIndex, matches, container);
  };

  const handlePrevious = () => {
    if (matches.length === 0) return;
    const newIndex = currentIndex <= 0 ? matches.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
    const container = getEditorContainer?.();
    if (container) highlightCurrent(newIndex, matches, container);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePrevious();
      } else {
        handleNext();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <div className="find-box">
      <input
        ref={inputRef}
        type="text"
        className="find-input"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder="Find..."
      />
      <div className="find-counter">
        {matches.length === 0
          ? 'No results'
          : `${currentIndex + 1} of ${matches.length}`}
      </div>
      <button
        className="find-btn"
        onClick={handlePrevious}
        disabled={matches.length === 0}
      >
        ↑
      </button>
      <button
        className="find-btn"
        onClick={handleNext}
        disabled={matches.length === 0}
      >
        ↓
      </button>
      <button
        className="find-btn find-close-btn"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}

export default FindBox;
