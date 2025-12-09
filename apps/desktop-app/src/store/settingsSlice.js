import { createSlice } from '@reduxjs/toolkit';

/**
 * settingsSlice - Centralized settings state synced with localStorage
 * 
 * Purpose: Single source of truth for all persistent user settings.
 * Components read from Redux; changes are synced to localStorage.
 * This eliminates scattered localStorage reads across components.
 * 
 * Design: Each setting has a setter that also persists to localStorage.
 * On app init, loadAllSettings populates state from localStorage.
 */

// Helper to safely read from localStorage
const getStorageItem = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    if (typeof defaultValue === 'boolean') {
      return saved === 'true';
    }
    if (typeof defaultValue === 'object') {
      return JSON.parse(saved);
    }
    return saved;
  } catch (e) {
    return defaultValue;
  }
};

// Helper to safely write to localStorage
const setStorageItem = (key, value) => {
  try {
    if (typeof value === 'boolean') {
      localStorage.setItem(key, value ? 'true' : 'false');
    } else if (typeof value === 'object') {
      localStorage.setItem(key, JSON.stringify(value));
    } else if (value === null || value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    // Ignore storage errors
  }
};

const initialState = {
  isAIEnabled: true,              // AI sidebar enabled
  developerMode: true,            // Developer mode enabled
  backgroundImage: 'spacedreams.jpg',  // Background theme path
  showPreviewBar: true,           // Monaco minimap visible
  showMonacoLineNumbers: true,    // Monaco line numbers visible
  editorViewMode: 'array',        // Default editor view mode
  aiService: 'deepseek-server',   // Selected AI service
  apiKeys: {},                    // API keys by service
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setIsAIEnabled(state, action) {
      state.isAIEnabled = !!action.payload;
      setStorageItem('aiEnabled', state.isAIEnabled);
    },
    setDeveloperMode(state, action) {
      state.developerMode = !!action.payload;
      setStorageItem('developerMode', state.developerMode);
    },
    setBackgroundImage(state, action) {
      state.backgroundImage = action.payload || '';
      setStorageItem('backgroundImage', state.backgroundImage);
    },
    setShowPreviewBar(state, action) {
      state.showPreviewBar = !!action.payload;
      setStorageItem('showPreviewBar', state.showPreviewBar);
    },
    setShowMonacoLineNumbers(state, action) {
      state.showMonacoLineNumbers = !!action.payload;
      setStorageItem('showMonacoLineNumbers', state.showMonacoLineNumbers);
    },
    setEditorViewMode(state, action) {
      const mode = action.payload;
      if (mode === 'array' || mode === 'monaco' || mode === 'textarea') {
        state.editorViewMode = mode;
        setStorageItem('editorViewMode', mode);
      }
    },
    setAiService(state, action) {
      state.aiService = action.payload || 'deepseek-server';
      setStorageItem('aiService', state.aiService);
    },
    setApiKeys(state, action) {
      state.apiKeys = action.payload || {};
      setStorageItem('apiKeys', state.apiKeys);
    },
    updateApiKey(state, action) {
      const { service, key } = action.payload;
      state.apiKeys = { ...state.apiKeys, [service]: key };
      setStorageItem('apiKeys', state.apiKeys);
    },
    // Load all settings from localStorage on app init
    loadAllSettings(state) {
      state.isAIEnabled = getStorageItem('aiEnabled', true);
      state.developerMode = getStorageItem('developerMode', true);
      state.backgroundImage = getStorageItem('backgroundImage', 'spacedreams.jpg');
      state.showPreviewBar = getStorageItem('showPreviewBar', true);
      state.showMonacoLineNumbers = getStorageItem('showMonacoLineNumbers', true);
      
      // Handle editorViewMode with migration from 'fold' to 'array'
      let savedViewMode = getStorageItem('editorViewMode', 'array');
      if (savedViewMode === 'fold') savedViewMode = 'array';
      state.editorViewMode = savedViewMode;
      
      state.aiService = getStorageItem('aiService', 'deepseek-server');
      state.apiKeys = getStorageItem('apiKeys', {});
    },
    // Generic setter for updating any setting
    updateSetting(state, action) {
      const { key, value } = action.payload;
      if (key in state) {
        state[key] = value;
        setStorageItem(key === 'isAIEnabled' ? 'aiEnabled' : key, value);
      }
    },
  },
});

export const {
  setIsAIEnabled,
  setDeveloperMode,
  setBackgroundImage,
  setShowPreviewBar,
  setShowMonacoLineNumbers,
  setEditorViewMode,
  setAiService,
  setApiKeys,
  updateApiKey,
  loadAllSettings,
  updateSetting,
} = settingsSlice.actions;

// Selectors
export const selectIsAIEnabled = (state) => state.settings.isAIEnabled;
export const selectDeveloperMode = (state) => state.settings.developerMode;
export const selectBackgroundImage = (state) => state.settings.backgroundImage;
export const selectShowPreviewBar = (state) => state.settings.showPreviewBar;
export const selectShowMonacoLineNumbers = (state) => state.settings.showMonacoLineNumbers;
export const selectEditorViewMode = (state) => state.settings.editorViewMode;
export const selectAiService = (state) => state.settings.aiService;
export const selectApiKeys = (state) => state.settings.apiKeys;

export default settingsSlice.reducer;
