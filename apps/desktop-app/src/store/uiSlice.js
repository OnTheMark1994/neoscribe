import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSettingsOpen: false,
  settingsTab: null, // 'general' | 'ai' | 'account' | null
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openSettings(state, action) {
      const tab = action.payload && action.payload.tab ? action.payload.tab : 'general';
      state.isSettingsOpen = true;
      state.settingsTab = tab;
    },
    closeSettings(state) {
      state.isSettingsOpen = false;
      state.settingsTab = null;
    },
    setSettingsTab(state, action) {
      state.settingsTab = action.payload || null;
    },
  },
});

export const { openSettings, closeSettings, setSettingsTab } = uiSlice.actions;

export default uiSlice.reducer;
