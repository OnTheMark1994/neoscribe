import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectCurrentFilePath, setCurrentFilePath, setIsModified } from '../../store/editorSlice';
import MonacoNew from './MonacoNew';
import './EditorNew.css';

/**
 * EditorNew - Simple editor component that loads a file and displays it
 * Just shows the editor with the file content and lets the user type into it
 * No functions are called when the user types
 */
export default function EditorNew() {
  const dispatch = useDispatch();
  const currentFilePath = useSelector(selectCurrentFilePath);
  const [content, setContent] = useState('');

  // Load last opened file on mount
  useEffect(() => {
    const lastFile = localStorage.getItem('lastOpenedFile');
    if (lastFile && window.electronAPI && window.electronAPI.openEncryptedFileWithPath) {
      window.electronAPI.openEncryptedFileWithPath(lastFile).then(result => {
        if (result && result.success) {
          setContent(result.content);
          dispatch(setCurrentFilePath(result.filePath));
          dispatch(setIsModified(false));
        }
      }).catch(err => {
        console.log('Could not load last file:', err);
        localStorage.removeItem('lastOpenedFile');
      });
    }
  }, [dispatch]);

  // Handle content changes - just mark as modified, no other actions
  const handleContentChange = () => {
    dispatch(setIsModified(true));
  };

  return (
    <div className="editor-new-container">
      <MonacoNew content={content} onChange={handleContentChange} />
    </div>
  );
}