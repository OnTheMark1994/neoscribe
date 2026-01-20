import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import './ChangeNavigator.css';
import { setShowDiffView } from '../../../Global/ReduxSlices/EditorSlice';

function ChangeNavigator() {
  const dispatch = useDispatch();
  // Jump to next is obtained from the settings
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  // An array of chunk buttons we are storing in a ref
  const chunkButtonsRef = useRef([]);
  // Number of chunks, used for display and bounds
  const [nChunks, setNChunks] = useState(0);
  // The currently selected index (as a ref and state)
  const [currentIndexState, setCurrentIndexState] = useState(0);
  const currentIndexRef = useRef(0);
  const setCurrentIndex = (newIndex) => {
    currentIndexRef.current = newIndex;
    setCurrentIndexState(newIndex);
  };
  // A flag so we remember if the selected index was just removed
  const indexMatchedRef = useRef(false);

  // Refresh the chunk buttons from the DOM and update nChunks
  const refreshChunks = () => {
    const buttons = Array.from(document.querySelectorAll('.cm-chunkButtons'));
    chunkButtonsRef.current = buttons;
    setNChunks(buttons.length);
    return buttons;
  };


  // Hilights and scrolls to an index
  const selectIndex = (index) => {
    console.log("selecging index", index)
    setCurrentIndex(index)

    // Clear all highlights
    const allHighlighted = document.querySelectorAll('.cm-chunkButtons-highlighted');
    allHighlighted.forEach(el => el.classList.remove('cm-chunkButtons-highlighted'));

    const allCurrent = document.querySelectorAll('.cm-chunkButtons-current');
    allCurrent.forEach(el => el.classList.remove('cm-chunkButtons-current'));

    // Get chunk from DOM (not stale state)
    const allButtons = document.querySelectorAll('.cm-chunkButtons');
    const chunk = allButtons[index];
    if (chunk) {
      chunk.classList.add('cm-chunkButtons-current');
      highlightChunk(chunk);
      scrollToChunk(chunk);
    }
  };

  //  Helper to hilight the given chunk (add hilighted css)
  const highlightChunk = (chunk) => {
    if (!chunk) return;

    const allHighlighted = document.querySelectorAll('.cm-chunkButtons-highlighted');
    allHighlighted.forEach(el => el.classList.remove('cm-chunkButtons-highlighted'));

    chunk.classList.add('cm-chunkButtons-highlighted');
  };

  // Helper to scroll to the given chunk
  const scrollToChunk = (chunk) => {
    if (!chunk) return;

    chunk.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  };

  useEffect(() => {

    // Gets an array of the buttons, updates ref and nChunks, adds click listeners
    const findChunkButtons = () => {
      const buttonContainers = refreshChunks();

      buttonContainers.forEach((container, index) => {
        container.dataset.chunkIndex = index;

        const acceptBtn = container.querySelector('button[name="accept"]');
        const rejectBtn = container.querySelector('button[name="reject"]');

        if (acceptBtn && !acceptBtn.hasChunkListener) {
          acceptBtn.addEventListener('mousedown', (e) => {
            const chunkIndex = parseInt(e.target.closest('.cm-chunkButtons').dataset.chunkIndex);
            handleChunkClick(e, chunkIndex, 'accept');
          }, true);
          acceptBtn.hasChunkListener = true;
        }

        if (rejectBtn && !rejectBtn.hasChunkListener) {
          rejectBtn.addEventListener('mousedown', (e) => {
            const chunkIndex = parseInt(e.target.closest('.cm-chunkButtons').dataset.chunkIndex);
            handleChunkClick(e, chunkIndex, 'reject');
          }, true);
          rejectBtn.hasChunkListener = true;
        }
      });
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
    };
  }, []);

  // When accept/reject is clicked this is called, it 
  const handleChunkClick = (e, clickedIndex, action) => {
    // Check to see if the index matched the selected index and save it as a flag
    const wasCurrentIndex = clickedIndex === currentIndexRef.current;
    indexMatchedRef.current = wasCurrentIndex;
    
    // The auto jump setting
    const autoJump = settingsObject?.autoJumpToNextChunk;

    // Auto jump to next index if setting is on
    if (autoJump) {
      setTimeout(() => {
        // Query updated chunk buttons after accept/reject
        const updatedButtons = Array.from(document.querySelectorAll('.cm-chunkButtons'));
        const newLength = updatedButtons.length;

        if (newLength === 0) return;

        // Calculate next index based on updated state
        const nextIndex = clickedIndex === newLength - 1 ? 0 : clickedIndex;
        selectIndex(nextIndex);
      }, 250);
    }
  };

  // Previous button click
  const handlePrevious = () => {
    if (nChunks === 0) return;

    // If index matched on accept/reject, just highlight without changing index
    if (indexMatchedRef.current) {
      indexMatchedRef.current = false;
      selectIndex(currentIndexState);
      return;
    }

    // Prev one (looping to top if it goes under 0)
    const newIndex = currentIndexState === 0 ? nChunks - 1 : currentIndexState - 1;
    selectIndex(newIndex);
  };
  // Next button click
  const handleNext = () => {
    if (nChunks === 0) return;

    // Reset flag when next is pressed
    indexMatchedRef.current = false;

    // Next one (looping back if it goes over the length)
    const newIndex = currentIndexState === nChunks - 1 ? 0 : currentIndexState + 1;
    selectIndex(newIndex);

  };
  // Accept all button click
  const handleAcceptAll = () => {
    // Find all accept buttons and click them
    const acceptButtons = document.querySelectorAll('button[name="accept"]');
    acceptButtons.forEach(btn => btn.click());

    // Exit diff view
    dispatch(setShowDiffView(false));
  };
  // Reject all button click
  const handleRejectAll = () => {
    // Find all reject buttons and click them
    const rejectButtons = document.querySelectorAll('button[name="reject"]');
    rejectButtons.forEach(btn => btn.click());

    // Exit diff view
    dispatch(setShowDiffView(false));
  };

  return (
    <div className="diff-navigation-bar">
      <button className="diff-nav-btn" onClick={handlePrevious} title="Previous change">
        ▲
      </button>
      <span className="diff-counter">
        {nChunks > 0 ? `${currentIndexState + 1} of ${nChunks}` : 'Diff Mode Active'}
      </span>
      <button className="diff-nav-btn" onClick={handleNext} title="Next change">
        ▼
      </button>
      <div className="diff-nav-divider"></div>
      <button className="diff-nav-btn diff-nav-accept-all" onClick={handleAcceptAll} title="Accept all changes">
        Accept All
      </button>
      <button className="diff-nav-btn diff-nav-reject-all" onClick={handleRejectAll} title="Reject all changes">
        Reject All
      </button>
    </div>
  );
}

export default ChangeNavigator;
