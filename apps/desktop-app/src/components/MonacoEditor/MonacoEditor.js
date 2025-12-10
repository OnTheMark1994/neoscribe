import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  selectContent, 
  setIsModified 
} from '../../store/editorSlice';
import MonacoEditorView from './MonacoEditorView';

/**
 * MonacoEditor.js
 * 
 * Thin wrapper around Monaco code editor.
 * Uses Monaco's internal model (uncontrolled), not React-controlled state.
 * 
 * Design: defaultValue only, NO value prop, NO onChange for content
 */
function MonacoEditor() {
  const dispatch = useDispatch();
  const reduxContent = useSelector(selectContent);
  
  const monacoRef = useRef(null);

  /**
   * initMonaco - Called once when Monaco mounts
   * Stores instance in ref and subscribes to content changes for isModified tracking
   */
  const initMonaco = (editorInstance) => {
    monacoRef.current = editorInstance;
    
    // Subscribe to content changes to mark file as modified
    // Note: We do NOT sync content to React state - Monaco manages its own buffer
    editorInstance.onDidChangeModelContent(() => {
      dispatch(setIsModified(true));
    });
  };

  /**
   * foldAll - Use Monaco's built-in fold action
   * Called externally via Redux trigger from WebMenuBar
   */
  useEffect(() => {
    // TODO: Wire this to Redux trigger when WebMenuBar is refactored
  }, []);

  /**
   * unfoldAll - Use Monaco's built-in unfold action
   * Called externally via Redux trigger from WebMenuBar
   */
  useEffect(() => {
    // TODO: Wire this to Redux trigger when WebMenuBar is refactored
  }, []);

  /**
   * extractContent - Get current content from Monaco
   * Called externally by WebMenuBar when saving file
   * 
   * Note: This is accessed via ref from parent, not directly called here
   */
  React.useImperativeHandle(monacoRef, () => ({
    extractContent: () => {
      return monacoRef.current?.getValue() || '';
    }
  }));

  return (
    <MonacoEditorView
      defaultValue={reduxContent}  // Initial text from Redux (uncontrolled)
      onMount={initMonaco}         // Capture instance, set up listeners
      monacoRef={monacoRef}        // Pass ref for external access
    />
  );
}

export default MonacoEditor;
