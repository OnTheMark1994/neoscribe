import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { rebuildChangeIds, toggleAutoAdvanceOnResolve, clearCurrentChangeSelection, setCurrentChangeIndex } from '../../../store/aiChangesSlice';
import { setIsModified } from '../../../store/editorSlice';
import { getLines, setLines } from '../../../utils/editorEngine';
import './DiffActionButtons.css';

/**
 * DiffActionButtons - Accept/Reject buttons for AI proposals in EditorArray
 * 
 * Directly modifies lines in editorEngine and rebuilds change IDs in Redux.
 * Uses aiChangesSlice for array editor (not aiSlice which is for Monaco).
 */
function DiffActionButtons({ proposedChangeId, changeType, onUpdate, onContentChange }) {
  const dispatch = useDispatch();
  const autoAdvance = useSelector(state => state.aiChanges.autoAdvanceOnResolve);

  /**
   * After accepting/rejecting, advance to the next change at or below the current line
   */
  const advanceToNextChangeBelow = (lines, fromLineIndex) => {
    const remaining = [];
    lines.forEach((l, idx) => {
      if (l.proposedChangeId) {
        remaining.push({ id: l.proposedChangeId, idx });
      }
    });

    if (remaining.length === 0) {
      dispatch(clearCurrentChangeSelection());
      return;
    }

    let targetPos = remaining.findIndex(c => c.idx >= fromLineIndex);
    if (targetPos === -1) {
      targetPos = 0;
    }

    dispatch(setCurrentChangeIndex(targetPos));
  };

  /**
   * Accept the proposed change
   */
  const acceptChange = () => {
    console.log('[DIFF] Accepting change, autoAdvance:', autoAdvance);
    const lines = getLines();
    const lineIndex = lines.findIndex(l => l.proposedChangeId === proposedChangeId);
    if (lineIndex === -1) return;
    
    const line = lines[lineIndex];
    
    if (line.proposedChangeType === 'modify') {
      // Accept modify: set text to modifyTo and remove proposal properties
      line.text = line.modifyTo;
      delete line.proposedChangeType;
      delete line.proposedChangeId;
      delete line.modifyFrom;
      delete line.modifyTo;
      
    } else if (line.proposedChangeType === 'insert') {
      // Accept insert: remove proposal properties (becomes normal line)
      delete line.proposedChangeType;
      delete line.proposedChangeId;
      
    } else if (line.proposedChangeType === 'delete') {
      // Accept delete: remove the line from array
      lines.splice(lineIndex, 1);
    }
    
    setLines(lines);
    dispatch(rebuildChangeIds(lines));
    dispatch(setIsModified(true));
    
    if (autoAdvance) {
      console.log('[DIFF] Auto-advancing to next change (accept)');
      advanceToNextChangeBelow(lines, lineIndex);
    } else {
      dispatch(clearCurrentChangeSelection());
    }
    
    if (onUpdate) {
      onUpdate();
    }
    if (onContentChange) {
      onContentChange();
    }
  };

  /**
   * Reject the proposed change
   */
  const rejectChange = () => {
    console.log('[DIFF] Rejecting change, autoAdvance:', autoAdvance);
    const lines = getLines();
    const lineIndex = lines.findIndex(l => l.proposedChangeId === proposedChangeId);
    if (lineIndex === -1) return;
    
    const line = lines[lineIndex];
    
    if (line.proposedChangeType === 'modify') {
      // Reject modify: keep text as modifyFrom and remove proposal properties
      line.text = line.modifyFrom;
      delete line.proposedChangeType;
      delete line.proposedChangeId;
      delete line.modifyFrom;
      delete line.modifyTo;
      
    } else if (line.proposedChangeType === 'insert') {
      // Reject insert: remove the line from array
      lines.splice(lineIndex, 1);
      
    } else if (line.proposedChangeType === 'delete') {
      // Reject delete: remove proposal properties (keep the line)
      delete line.proposedChangeType;
      delete line.proposedChangeId;
    }
    
    setLines(lines);
    dispatch(rebuildChangeIds(lines));
    dispatch(setIsModified(true));
    
    if (autoAdvance) {
      console.log('[DIFF] Auto-advancing to next change (reject)');
      advanceToNextChangeBelow(lines, lineIndex);
    } else {
      dispatch(clearCurrentChangeSelection());
    }

    if (onUpdate) {
      onUpdate();
    }
    if (onContentChange) {
      onContentChange();
    }
  };

  return (
    <div className="diff-actions-inline" data-change-id={proposedChangeId}>
      {changeType === 'delete' && (
        <span className="delete-indicator">DELETE THIS LINE</span>
      )}
      <button 
        className="diff-btn-inline diff-btn-reject" 
        onClick={rejectChange}
      >
        Reject
      </button>
      <button 
        className="diff-btn-inline diff-btn-accept" 
        onClick={acceptChange}
      >
        Accept
      </button>
      <button
        type="button"
        className={`diff-auto-advance-toggle${autoAdvance ? ' diff-auto-advance-on' : ''}`}
        onClick={() => dispatch(toggleAutoAdvanceOnResolve())}
        title="Jump to next change"
      >
        <span className="diff-toggle-track">
          <span className="diff-toggle-knob" />
        </span>
        <span className="diff-toggle-label">Jump</span>
      </button>
    </div>
  );
}

export default DiffActionButtons;
