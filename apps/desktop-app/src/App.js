import React from 'react';
import { useSelector } from 'react-redux';
import { selectIsAIEnabled } from './store/settingsSlice';
import SimpleMonaco from './components/SimpleMonaco';
import AISidebar from './components/AISidebar';
import WebMenuBar from './components/WebMenuBar';
import AppInitializer from './components/AppInitializer';
import LoadingScreen from './components/LoadingScreen';
import Menus from './components/Menus';
import StatusBar from './components/StatusBar';
import './App.css';

/**
 * App.js - Ultra simple: Monaco + AI sidebar + unified menu bar
 * Zero custom editor logic, just fast editing
 */
function App() {
  const isAIEnabled = useSelector(selectIsAIEnabled);

  return (
    <div className={`App has-web-menu ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
      <AppInitializer />
      <LoadingScreen />
      <Menus />
      <WebMenuBar />

      <div id="backgroundContainer" className="background-container" />

      <div className={`page-container ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
        <div className="page">
          <SimpleMonaco />
        </div>
      </div>
      
      {isAIEnabled && <AISidebar />}
      <StatusBar />
    </div>
  );
}

export default App;
