import { createSlice } from '@reduxjs/toolkit';

/**
 * uiSlice - Transient UI state for modals, loading, and visibility
 * 
 * Purpose: Centralize modal visibility and UI state.
 * Components read visibility from Redux and dispatch to open/close modals.
 * This eliminates scattered useState for modal visibility across components.
 */

const initialState = {
  isSettingsOpen: false,
  settingsTab: null,              // 'general' | 'display' | 'ai' | 'account' | null
  showUnsavedDialog: false,       // Unsaved changes modal
  showDownloadModal: false,       // Web download modal
  isLoadingVisible: true,         // Loading screen visible (true on app start)
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    openSettings(state, action) {
      const rawTab = action && action.payload ? action.payload.tab : null;
      const validTabs = ['general', 'display', 'ai', 'account'];
      const tab = validTabs.includes(rawTab) ? rawTab : null;
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
    openUnsavedDialog(state) {
      state.showUnsavedDialog = true;
    },
    closeUnsavedDialog(state) {
      state.showUnsavedDialog = false;
    },
    openDownloadModal(state) {
      state.showDownloadModal = true;
    },
    closeDownloadModal(state) {
      state.showDownloadModal = false;
    },
    setLoadingVisible(state, action) {
      state.isLoadingVisible = !!action.payload;
    },
  },
});

export const {
  openSettings,
  closeSettings,
  setSettingsTab,
  openUnsavedDialog,
  closeUnsavedDialog,
  openDownloadModal,
  closeDownloadModal,
  setLoadingVisible,
} = uiSlice.actions;

// Selectors
export const selectIsSettingsOpen = (state) => state.ui.isSettingsOpen;
export const selectSettingsTab = (state) => state.ui.settingsTab;
export const selectShowUnsavedDialog = (state) => state.ui.showUnsavedDialog;
export const selectShowDownloadModal = (state) => state.ui.showDownloadModal;
export const selectIsLoadingVisible = (state) => state.ui.isLoadingVisible;

export default uiSlice.reducer;
