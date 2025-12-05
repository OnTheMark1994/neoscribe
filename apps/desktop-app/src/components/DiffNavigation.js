import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { nextChange, previousChange, clearAIChanges } from '../store/aiChangesSlice';
import { getLines, setLines } from '../utils/editorEngine';
import './DiffNavigation.css';

function DiffNavigation({ onUpdate }) {
  const dispatch = useDispatch();
  const { allChangeIds, currentChangeIdIndex } = useSelector(state => state.aiChanges);

  if (allChangeIds.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    console.log('[DIFFNAV] Previous requested from index:', currentChangeIdIndex, 'of', allChangeIds.length);
    dispatch(previousChange());
  };

  const handleNext = () => {
    console.log('[DIFFNAV] Next requested from index:', currentChangeIdIndex, 'of', allChangeIds.length);
    dispatch(nextChange());
  };

  const handleAcceptAll = () => {
    const lines = getLines();
    
    // Process all changes
    lines.forEach(line => {
      if (line.proposedChangeType === 'modify') {
        line.text = line.modifyTo;
        delete line.proposedChangeType;
        delete line.proposedChangeId;
        delete line.modifyFrom;
        delete line.modifyTo;
      } else if (line.proposedChangeType === 'insert') {
        delete line.proposedChangeType;
        delete line.proposedChangeId;
      } else if (line.proposedChangeType === 'delete') {
        // Mark for deletion
        line._toDelete = true;
      }
    });
    
    // Remove lines marked for deletion
    const filteredLines = lines.filter(l => !l._toDelete);
    
    setLines(filteredLines);
    dispatch(clearAIChanges());
    
    if (onUpdate) {
      onUpdate();
    }
  };

  const handleRejectAll = () => {
    const lines = getLines();
    
    // Process all changes
    lines.forEach(line => {
      if (line.proposedChangeType === 'modify') {
        line.text = line.modifyFrom;
        delete line.proposedChangeType;
        delete line.proposedChangeId;
        delete line.modifyFrom;
        delete line.modifyTo;
      } else if (line.proposedChangeType === 'insert') {
        // Mark for deletion
        line._toDelete = true;
      } else if (line.proposedChangeType === 'delete') {
        delete line.proposedChangeType;
        delete line.proposedChangeId;
      }
    });
    
    // Remove lines marked for deletion
    const filteredLines = lines.filter(l => !l._toDelete);
    
    setLines(filteredLines);
    dispatch(clearAIChanges());
    
    if (onUpdate) {
      onUpdate();
    }
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
        Change {currentChangeIdIndex + 1} of {allChangeIds.length}
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

export default DiffNavigation;
