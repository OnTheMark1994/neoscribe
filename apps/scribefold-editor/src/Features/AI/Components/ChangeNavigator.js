import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import './ChangeNavigator.css';

function ChangeNavigator() {
  const showDiffView = useSelector(state => state.editorSlice.showDiffView);
  const [chunkButtons, setChunkButtons] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const highlightTimeoutRef = useRef(null);



  useEffect(() => {
    if (!showDiffView) {
      setChunkButtons([]);
      setCurrentIndex(0);
      return;
    }

    const findChunkButtons = () => {
      const buttons = document.querySelectorAll('.cm-chunkButtons');
      setChunkButtons(Array.from(buttons));
      console.log('[ChangeNavigator] Found', buttons.length, 'chunk buttons');
    };

    findChunkButtons();

    const observer = new MutationObserver(() => {
      findChunkButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [showDiffView]);

  const highlightChunk = (chunk) => {
    if (!chunk) return;

    // Remove current hilighted css
    const allHighlighted = document.querySelectorAll('.cm-chunkButtons-highlighted');
    allHighlighted.forEach(el => el.classList.remove('cm-chunkButtons-highlighted'));

    chunk.classList.add('cm-chunkButtons-highlighted');

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }

    highlightTimeoutRef.current = setTimeout(() => {
      chunk.classList.remove('cm-chunkButtons-highlighted');
    }, 2000);
  };

  const scrollToChunk = (chunk) => {
    if (!chunk) return;

    chunk.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  };

  const handlePrevious = () => {
    if (chunkButtons.length === 0) return;

    const newIndex = currentIndex === 0 ? chunkButtons.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);

    const chunk = chunkButtons[newIndex];
    highlightChunk(chunk);
    scrollToChunk(chunk);

    console.log('[ChangeNavigator] Previous: chunk', newIndex + 1, 'of', chunkButtons.length);
  };

  const handleNext = () => {
    if (chunkButtons.length === 0) return;

    const newIndex = currentIndex === chunkButtons.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);

    const chunk = chunkButtons[newIndex];
    highlightChunk(chunk);
    scrollToChunk(chunk);

    console.log('[ChangeNavigator] Next: chunk', newIndex + 1, 'of', chunkButtons.length);
  };

  const handleAcceptAll = () => {
    console.log('[ChangeNavigator] Accept All clicked');
  };

  const handleRejectAll = () => {
    console.log('[ChangeNavigator] Reject All clicked');
  };

  return (
    <div className="diff-navigation-bar">
      <button
        className="diff-nav-btn"
        onClick={handlePrevious}
        title="Previous change"
      >
        ▲
      </button>
      <span className="diff-counter">
        {chunkButtons.length > 0
          ? `${currentIndex + 1} of ${chunkButtons.length}`
          : 'Diff Mode Active'}
      </span>
      <button
        className="diff-nav-btn"
        onClick={handleNext}
        title="Next change"
      >
        ▼
      </button>
      <div className="diff-nav-divider"></div>
      <button
        className="diff-nav-btn diff-nav-accept-all"
        onClick={handleAcceptAll}
        title="Accept all changes"
      >
        Accept All
      </button>
      <button
        className="diff-nav-btn diff-nav-reject-all"
        onClick={handleRejectAll}
        title="Reject all changes"
      >
        Reject All
      </button>
    </div>
  );
}

export default ChangeNavigator;
