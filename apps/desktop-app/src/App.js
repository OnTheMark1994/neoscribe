import React, { useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectIsAIEnabled } from './store/settingsSlice';
import SimpleMonaco from './components/SimpleMonaco';
import AISidebar from './components/AISidebar';
import AiNavBar from './components/AiNavBar';
import WebMenuBar from './components/WebMenuBar';
import AppInitializer from './components/AppInitializer';
import LoadingScreen from './components/LoadingScreen';
import Menus from './components/Menus';
import StatusBar from './components/StatusBar';
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
          <SimpleMonaco ref={monacoRef} />
        </div>
      </div>
      
      {isAIEnabled && <AISidebar monacoRef={monacoRef} />}
      {isAIEnabled && monacoRef.current && (
        <AiNavBar
          aiManager={monacoRef.current.getAiManager()}
          lineIdToNumber={monacoRef.current.getLineIdToNumberMap()}
        />
      )}
      <StatusBar />
    </div>
  );
}

export default App;
