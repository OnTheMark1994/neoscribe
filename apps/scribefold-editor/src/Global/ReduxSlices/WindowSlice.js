import { createSlice } from '@reduxjs/toolkit';
/*


*/
const initialState = {
  // Settings window
  showSettingsWindow: false,
  settingsInitialTab: null,

  // Save before closing window
  showSaveBeforeClosingWindow: false,

  // Message detail (developer) window
  showMessageDetailWindow: false,
  messageDetailData: null,

  showHelpWindow: false,
  helpWindowInitialSection: null,

  showRightClickWindow: false,
  rightClickWindowType: null,
  rightClickWindowLeft: 0,
  rightClickWindowTop: 0,
};

const windowSlice = createSlice({
  name: 'windowSlice',
  initialState,
  reducers: {
    setShowSettingsWindow(state, action) {
      const next = action.payload;
      state.showSettingsWindow = typeof next === 'boolean' ? next : !state.showSettingsWindow;
      if (!state.showSettingsWindow) state.settingsInitialTab = null;
    },
    setSettingsInitialTab(state, action) {
      state.settingsInitialTab = action.payload ?? null;
    },
    openSettingsWindow(state, action) {
      state.showSettingsWindow = true;
      state.settingsInitialTab = action.payload ?? null;
    },
    closeSettingsWindow(state) {
      state.showSettingsWindow = false;
      state.settingsInitialTab = null;
    },

    setShowSaveBeforeClosingWindow(state, action) {
      const next = action.payload;
      state.showSaveBeforeClosingWindow = typeof next === 'boolean' ? next : !state.showSaveBeforeClosingWindow;
    },

    openMessageDetailWindow(state, action) {
      state.showMessageDetailWindow = true;
      state.messageDetailData = action.payload ?? null;
    },
    closeMessageDetailWindow(state) {
      state.showMessageDetailWindow = false;
      state.messageDetailData = null;
    },

    setShowHelpWindow(state, action) {
      const next = action.payload;
      state.showHelpWindow = typeof next === 'boolean' ? next : !state.showHelpWindow;
    },
    setHelpWindowInitialSection(state, action) {
      state.helpWindowInitialSection = action.payload ?? null;
    },
    openHelpWindow(state, action) {
      state.showHelpWindow = true;
      state.helpWindowInitialSection = action.payload ?? null;
    },
    closeHelpWindow(state) {
      state.showHelpWindow = false;
      state.helpWindowInitialSection = null;
    },

    openRightClickWindow(state, action) {
      const { left = 0, top = 0, type = null } = action.payload || {};
      state.showRightClickWindow = true;
      state.rightClickWindowLeft = left;
      state.rightClickWindowTop = top;
      state.rightClickWindowType = type;
    },
    closeRightClickWindow(state) {
      state.showRightClickWindow = false;
      state.rightClickWindowType = null;
    },
  },
});

export const {
  setShowSettingsWindow,
  setSettingsInitialTab,
  openSettingsWindow,
  closeSettingsWindow,
  setShowSaveBeforeClosingWindow,
  openMessageDetailWindow,
  closeMessageDetailWindow,
  setShowHelpWindow,
  setHelpWindowInitialSection,
  openHelpWindow,
  closeHelpWindow,
  openRightClickWindow,
  closeRightClickWindow,
} = windowSlice.actions;

export default windowSlice.reducer;
