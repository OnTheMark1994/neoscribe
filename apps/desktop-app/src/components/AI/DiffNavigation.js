import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectFlattenedChanges, selectActiveChangeId, setActiveChangeId, acceptAllProposals, rejectAllProposals } from '../../store/aiSlice';
import './DiffNavigation.css';

function DiffNavigation() {
  const dispatch = useDispatch();
  const changes = useSelector(selectFlattenedChanges);
  const activeChangeId = useSelector(selectActiveChangeId);

  console.log('[DIFFNAV] Render:', {
    changesCount: changes.length,
    changeIds: changes.map(c => c.id),
    activeChangeId,
  });

  if (changes.length === 0) {
    return null;
  }

  const currentIndex = changes.findIndex(c => c.id === activeChangeId);
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
  
  console.log('[DIFFNAV] Current index:', currentIndex, 'Display:', displayIndex);

  const handlePrevious = () => {
    if (changes.length === 0) return;
    
    let newIndex = currentIndex - 1;
    if (newIndex < 0) {
      newIndex = changes.length - 1; // Wrap to last
    }
    
    dispatch(setActiveChangeId(changes[newIndex].id));
    console.log('[DIFFNAV] Previous: now at', newIndex + 1, 'of', changes.length, 'id:', changes[newIndex].id);
  };

  const handleNext = () => {
    if (changes.length === 0) return;
    
    let newIndex = currentIndex + 1;
    if (newIndex >= changes.length) {
      newIndex = 0; // Wrap to first
    }
    
    dispatch(setActiveChangeId(changes[newIndex].id));
    console.log('[DIFFNAV] Next: now at', newIndex + 1, 'of', changes.length, 'id:', changes[newIndex].id);
  };

  const handleAcceptAll = () => {
    // TODO: Implement accept all logic with Monaco diff editor
    console.log('[DIFFNAV] Accept all clicked (not yet implemented)');
    dispatch(acceptAllProposals());
  };

  const handleRejectAll = () => {
    // TODO: Implement reject all logic with Monaco diff editor
    console.log('[DIFFNAV] Reject all clicked (not yet implemented)');
    dispatch(rejectAllProposals());
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
        Change {displayIndex} of {changes.length}
        {activeChangeId && <span className="diff-id"> (ID: {activeChangeId})</span>}
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
