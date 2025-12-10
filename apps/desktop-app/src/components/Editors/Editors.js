import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectEditorViewMode } from '../../store/settingsSlice';
import ArrayEditor from '../ArrayEditor/ArrayEditor';
import MonacoEditor from '../MonacoEditor/MonacoEditor';
import TextareaEditor from '../TextareaEditor/TextareaEditor';
import FindBar from '../FindBar/FindBar';
import './Editors.css';

/**
 * Editors.js - Router component
 * 
 * Displays the correct editor based on Redux viewMode state.
 * No local state, no functions - pure presentation.
 */
function Editors() {
  const viewMode = useSelector(selectEditorViewMode);
  const [isFindVisible, setIsFindVisibleLocal] = useState(false);

  // Handle Ctrl+F keyboard shortcut
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F or Cmd+F
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        
        if (viewMode === 'monaco') {
          // Monaco has built-in find, trigger it
          // The monaco editor itself will handle this via its own keyboard shortcuts
          return;
        }
        
        // For array/textarea views, show our custom FindBar
        setIsFindVisibleLocal(true);
      }
      
      // Escape to close FindBar
      if (e.key === 'Escape' && isFindVisible) {
        setIsFindVisibleLocal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, isFindVisible]);

  return (
    <>
      {/* FindBar: Only shown for array/textarea views. Monaco has built-in Ctrl+F */}
      {isFindVisible && viewMode !== 'monaco' && (
        <FindBar
          onClose={() => setIsFindVisibleLocal(false)}
        />
      )}

      {/* Render the active editor based on viewMode */}
      {viewMode === 'array' && <ArrayEditor />}
      {viewMode === 'monaco' && <MonacoEditor />}
      {viewMode === 'textarea' && <TextareaEditor />}
    </>
  );
}

export default Editors;
