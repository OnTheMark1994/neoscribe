import React, { useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAIEnabled } from './store/settingsSlice';
import { selectViewType } from './store/editorSlice';
import SimpleMonaco from './components/Editor/SimpleMonaco';
import EditorArray from './components/EditorArray/EditorArray';
import AISidebar from './components/AI/AISidebar';
import WebMenuBar from './components/UI/WebMenuBar';
import AppInitializer from './components/Data/AppInitializer';
import LoadingScreen from './components/UI/LoadingScreen';
import Menus from './components/Windows/Menus';
import StatusBar from './components/UI/StatusBar';
import './App.css';

/**
 * App.js - Main application component
 * 
 * Renders either:
 * - EditorArray: Line-based fold editor with array view (default)
 * - SimpleMonaco: Monaco code editor
 * 
 * Based on Redux viewType state ('array' or 'monaco')
 */
function App() {
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const viewType = useSelector(selectViewType);
  
  // Unified editor ref - works for both SimpleMonaco and EditorArray
  const editorRef = useRef(null);

  return (
    <div className={`App has-web-menu ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
      <AppInitializer />
      <LoadingScreen />
      <Menus />
      <WebMenuBar />

      <div id="backgroundContainer" className="background-container" />

      <div className={`page-container ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
        <div className="page">
          {/* Conditionally render editor based on viewType */}
          {viewType === 'array' ? (
            <EditorArray ref={editorRef} />
          ) : (
            <SimpleMonaco ref={editorRef} />
          )}
        </div>
      </div>
      
      {isAIEnabled && <AISidebar monacoRef={editorRef} />}
      <StatusBar />
    </div>
  );
}

export default App;
