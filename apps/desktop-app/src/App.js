import React, { useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAIEnabled } from './store/settingsSlice';
import SimpleMonaco from './components/Editor/SimpleMonaco';
import DiffMonaco from './components/Editor/DiffMonaco';
import AISidebar from './components/AI/AISidebar';
import WebMenuBar from './components/UI/WebMenuBar';
import AppInitializer from './components/Data/AppInitializer';
import LoadingScreen from './components/UI/LoadingScreen';
import Menus from './components/Windows/Menus';
import StatusBar from './components/UI/StatusBar';
import './App.css';

/**
 * App.js - Monaco + AI sidebar + AI proposals navigation
 * Manages refs for SimpleMonaco to expose AI functionality
 */
function App() {
  const isAIEnabled = useSelector(selectIsAIEnabled);
  const monacoRef = useRef(null);

  return (
    <div className={`App has-web-menu ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
      <AppInitializer />
      <LoadingScreen />
      <Menus />
      <WebMenuBar />

      <div id="backgroundContainer" className="background-container" />

      <div className={`page-container ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
        <div className="page">
          {/* Leave this here just commented out for now */}
          {/* <SimpleMonaco ref={monacoRef} /> */}
          <DiffMonaco />
        </div>
      </div>
      
      {isAIEnabled && <AISidebar monacoRef={monacoRef} />}
      <StatusBar />
    </div>
  );
}

export default App;
