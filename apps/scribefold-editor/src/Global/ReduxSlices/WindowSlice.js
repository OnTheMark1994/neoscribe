import { createSlice } from '@reduxjs/toolkit';
const initialState = {
  // Settings window
  showSettingsWindow: false,
  settingsInitialTab: null,
  // Save before closing window
  showSaveBeforeClosingWindow: false,
  // Message detail (developer) window
  messageDetailData: null,
  // Help winodw data
  showHelpWindow: false,
  helpWindowInitialSection: null,
  // Right click menu data 
  showRightClickWindow: false,
  rightClickWindowType: null,
  rightClickWindowLeft: 0,
  rightClickWindowTop: 0,
  rightClickMenuOptions: [],

  // File encryption
  showFileEncryptionWindow: false,
  fileEncryptionMode: null, // 'encrypt' | 'unlock'
  fileEncryptionFilePath: null,
  fileEncryptionEncryptedText: null,
};

const windowSlice = createSlice({
  name: 'windowSlice',
  initialState,
  reducers: {
    // Show or hide the settings and set an intial tab with a string 
    setShowSettingsWindow(state, action) {
      // if its a string set initial tab to that string and show the window
      if(typeof action.payload === "string"){
        state.settingsInitialTab = action.payload
        state.showSettingsWindow = true
      }
      // If its a boolean set the show state to that boolean and clear initial tab
      else if (typeof action.payload === "boolean"){
        state.settingsInitialTab = null
        state.showSettingsWindow = action.payload
      }
    },
    // Show or hide the help window and set an intial section with a string 
    setShowHelpWindow(state, action) {
      const next = action.payload;
      state.showHelpWindow = typeof next === 'boolean' ? next : !state.showHelpWindow;
      
      // if its a string set initial tab to that string and show the window
      if(typeof action.payload === "string"){
        state.helpWindowInitialSection = action.payload
        state.showHelpWindow = true
      }
      // If its a boolean set the show state to that boolean and clear initial tab
      else if (typeof action.payload === "boolean"){
        state.helpWindowInitialSection = null
        state.showHelpWindow = action.payload
      }
    
    },
    // Save before closing window shows when user leaves with unsaved changes
    setShowSaveBeforeClosingWindow(state, action) {
      const next = action.payload;
      state.showSaveBeforeClosingWindow = typeof next === 'boolean' ? next : !state.showSaveBeforeClosingWindow;
    },
    // Dev debug window for messages, setting data to display shows menu 
    setMessageDetailDisplayData(state, action) {
      state.messageDetailData = action.payload ?? null;
    },
    // Opens on mous click with event data for positioning
    openRightClickWindow(state, action) {
      const { left = 0, top = 0, type = null, options = [] } = action.payload || {};
      state.showRightClickWindow = true;
      state.rightClickWindowLeft = left;
      state.rightClickWindowTop = top;
      state.rightClickWindowType = type;
      state.rightClickMenuOptions = options;
    },
    // Close the right click menu
    closeRightClickWindow(state) {
      state.showRightClickWindow = false;
      state.rightClickWindowType = null;
    },
    // Set right click menu options
    setRightClickMenuOptions(state, action) {
      state.rightClickMenuOptions = action.payload || [];
    },

    setShowFileEncryptionWindow(state, action) {
      const next = action.payload;

      if (typeof next === 'boolean') {
        state.showFileEncryptionWindow = next;
        if (!next) {
          state.fileEncryptionMode = null;
          state.fileEncryptionFilePath = null;
          state.fileEncryptionEncryptedText = null;
        }
        return;
      }

      if (next && typeof next === 'object') {
        state.showFileEncryptionWindow = true;
        state.fileEncryptionMode = next.mode ?? null;
        state.fileEncryptionFilePath = next.filePath ?? null;
        state.fileEncryptionEncryptedText = next.encryptedText ?? null;
      }
    },
  },
});

export const {
  setShowSettingsWindow,
  setShowSaveBeforeClosingWindow,
  setMessageDetailDisplayData,
  setShowHelpWindow,
  openRightClickWindow,
  closeRightClickWindow,
  setRightClickMenuOptions,
  setShowFileEncryptionWindow,
} = windowSlice.actions;

export default windowSlice.reducer;
