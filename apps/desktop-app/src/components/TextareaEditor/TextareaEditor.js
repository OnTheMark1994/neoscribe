import React, { useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectContent, setIsModified } from '../../store/editorSlice';
import TextareaEditorView from '../TextareaEditorView';

/**
 * TextareaEditor.js
 * 
 * Simple plain text editor using native textarea.
 * Minimal features, maximum simplicity.
 * 
 * Uses controlled input (value + onChange) because textarea is simple enough
 * that it doesn't cause performance issues.
 */
function TextareaEditor() {
  const dispatch = useDispatch();
  const reduxContent = useSelector(selectContent);
  const [content, setContent] = React.useState('');
  
  const textareaRef = useRef(null);

  // Sync Redux content to local state when file opens
  useEffect(() => {
    setContent(reduxContent);
  }, [reduxContent]);

  /**
   * handleContentChange - Update local state and mark as modified
   * Called internally from TextareaEditorView onChange
   */
  const handleContentChange = (newContent) => {
    setContent(newContent);
    dispatch(setIsModified(true));
  };

  /**
   * extractContent - Get current content from textarea
   * Called externally by WebMenuBar when saving file
   */
  React.useImperativeHandle(textareaRef, () => ({
    extractContent: () => {
      return textareaRef.current?.value || content;
    }
  }));

  return (
    <TextareaEditorView
      textareaRef={textareaRef}
      content={content}
      onContentChange={handleContentChange}
      placeholder="Start typing or use File menu to open a file..."
    />
  );
}

export default TextareaEditor;
