import React, { useRef, useEffect, useState } from 'react';
import {
  openSearchPanel,
  closeSearchPanel,
  setSearchQuery,
  findNext,
  findPrevious,
  SearchQuery,
  searchPanelOpen,
  replaceNext,
  replaceAll,
} from '@codemirror/search';
import { EditorView } from '@codemirror/view';
import './MinimalSearchBar.css';

export default function MinimalSearchBar({ editorRef, onClose }) {
  const inputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showExtendedOptions, setShowExtendedOptions] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchQuery, setSearchQueryState] = useState('');
  const [replaceText, setReplaceText] = useState('');

  const closeSearchBar = () => {
    const view = editorRef.current;
    if (!view) return;

    closeSearchPanel(view);

    setReplaceText('');
    setShowExtendedOptions(false);
    setIsPanelOpen(false);

    if (onClose) onClose();
  };

  // Escape key handler - always closes search panel regardless of focus
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
          closeSearchBar();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [editorRef]);

  // Keyboard listeners for Ctrl+F, Ctrl+H
  useEffect(() => {
    const handleKeyDown = (e) => {
        const view = editorRef.current;
        if (!view) return;

        // Ctrl+F or Ctrl+H - open search panel
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F' || e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            console.log("ctrk f, view: ", view)
            openSearchPanel(view);
            setIsPanelOpen(true)
        }
        // Ctrl+h for starting in search and replace mode 
        if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H')) {
            e.preventDefault();
            // Opening code is in the above keypress listener, just this part is necessary her
            setShowExtendedOptions(true);
        }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editorRef]);

  // Check if search panel is open

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isPanelOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isPanelOpen, inputRef]);

  if (!isPanelOpen) return null;

  const handleInput = (e) => {
    const view = editorRef.current;
    if (!view) return;

    const q = new SearchQuery({
      search: e.target.value,
      replace: replaceText,
      caseSensitive: caseSensitive,
    });

    setSearchQueryState(e.target.value);

    view.dispatch({
      effects: setSearchQuery.of(q)
    });
  };

  const handleReplaceInput = (e) => {
    const view = editorRef.current;
    if (!view) return;

    const newReplaceText = e.target.value;
    setReplaceText(newReplaceText);

    const q = new SearchQuery({
      search: searchQuery,
      replace: newReplaceText,
      caseSensitive: caseSensitive,
    });

    view.dispatch({
      effects: setSearchQuery.of(q)
    });
  };

  const toggleCaseSensitive = () => {
    const view = editorRef.current;
    if (!view) return;

    setCaseSensitive(!caseSensitive);

    const q = new SearchQuery({
      search: searchQuery,
      caseSensitive: !caseSensitive,
    });

    view.dispatch({
      effects: setSearchQuery.of(q)
    });
  };

  const goNext = () => {
    const view = editorRef.current;
    if (view) findNext(view);
  };

  const goPrev = () => {
    const view = editorRef.current;
    if (view) findPrevious(view);
  };

  const handleReplaceNext = () => {
    const view = editorRef.current;
    if (!view) return;

    replaceNext(view);
  };

  const handleReplaceAll = () => {
    const view = editorRef.current;
    if (!view) return;

    replaceAll(view);
  };

  return (
    <div className="minimal-search-bar">
      <div className="minimal-search-bar-row">
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            placeholder="Find in document..."
            className="search-input"
            onChange={handleInput}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                goNext();
              }
            }}
          />
          <button
            className={`search-option-button ${caseSensitive ? 'active' : ''}`}
            onClick={toggleCaseSensitive}
            title="Match Case"
          >
            Aa
          </button>
        </div>

        <button
          onClick={goPrev}
          title="Previous (Shift+F3)"
          className="nav-button"
        >
          ↑
        </button>

        <button
          onClick={goNext}
          title="Next (F3 / Enter)"
          className="nav-button"
        >
          ↓
        </button>

        <button
          onClick={() => setShowExtendedOptions(!showExtendedOptions)}
          title="Search Options"
          className="nav-button"
        >
          ☰
        </button>

        {onClose && (
          <button
            onClick={closeSearchBar}
            title="Close (Esc)"
            className="close-button"
          >
            ×
          </button>
        )}
      </div>

      {showExtendedOptions && (
        <div className="minimal-search-bar-row-extended">
            <input
                ref={replaceInputRef}
                type="text"
                placeholder="Replace with..."
                className="search-input"
                onChange={handleReplaceInput}
            />
            <button
                onClick={handleReplaceNext}
                title="Replace"
                className="nav-button nav-button-svg"
            >
                <svg width="60" height="25" viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg">
                    <text x="12" y="36" font-family="monospace" font-size="32" fill="currentColor">a</text>
                    <text x="62" y="38" font-family="monospace" font-size="32" fill="currentColor">b</text>
                    <path d="M36 30 L58 30 M56 28 L60 30 L56 32" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button
                onClick={handleReplaceAll}
                title="Replace All"
                className="nav-button nav-button-svg"
            >
                <svg width="70" height="25" viewBox="0 0 110 80" xmlns="http://www.w3.org/2000/svg">
                    <text x="12" y="28" font-family="monospace" font-size="28" fill="currentColor" opacity="0.7">A</text>
                    <text x="12" y="56" font-family="monospace" font-size="28" fill="currentColor" opacity="0.7">A</text>
                    <text x="72" y="28" font-family="monospace" font-size="28" fill="currentColor">B</text>
                    <text x="72" y="56" font-family="monospace" font-size="28" fill="currentColor">B</text>
                    <path d="M40 35 L66 35 M64 32 L68 35 L64 38" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <button
                onClick={closeSearchBar}
                title="Close (Esc)"
                className="close-button"
            >
                ×
            </button>
        </div>
      )}
    </div>
  );
}