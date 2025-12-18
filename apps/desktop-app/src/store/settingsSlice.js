import { createSlice } from '@reduxjs/toolkit';

/**
 * settingsSlice - Application settings and preferences
 * 
 * Purpose: Centralize all application settings with automatic localStorage persistence
 * 
 * Flow:
 * 1. Settings are loaded from localStorage on app startup (in AppInitializer)
 * 2. When settings change via updateSetting, they're automatically saved to localStorage
 * 3. All components access settings via settingsObject?.attribute pattern
 * 
 * Note: Settings are persisted across sessions via localStorage
 */

const initialState = {
  settingsObject: {}, // All settings key-value pairs
  loading: false,     // Loading state for settings operations
  error: null,        // Error state for settings operations
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Bulk set settings object (used on initial load)
    setSettingsObject(state, action) {
      state.settingsObject = action.payload || {};
    },
    
    // Update a single setting and persist to localStorage
    // Called when user changes any setting in the UI
    updateSetting(state, action) {
      const { settingName, value } = action.payload;
      console.log("in updateSetting: ", settingsName, value)
      if (settingName) {

        // 1. Update Redux state immediately for UI responsiveness
        state.settingsObject[settingName] = value;
        
        // 2. Persist to localStorage for session persistence
        try {
          const currentSettings = JSON.parse(localStorage.getItem("settingsObject") || "{}");
          currentSettings[settingName] = value;
          localStorage.setItem("settingsObject", JSON.stringify(currentSettings));
        } catch (error) {
          console.error("Error updating settings in localStorage:", error);
        }
      }
    },
    
    // Load settings from localStorage (called in AppInitializer on app startup)
    loadSettings(state) {
      try {
        const savedSettings = JSON.parse(localStorage.getItem("settingsObject") || "{}");
        state.settingsObject = savedSettings;
      } catch (error) {
        console.error("Error loading settings from localStorage:", error);
        state.settingsObject = {};
      }
    },
    
    // Controls loading state for settings operations
    setSettingsLoading(state, action) {
      state.loading = !!action.payload;
    },
    
    // Sets error state for settings operations
    setSettingsError(state, action) {
      state.error = action.payload || null;
    },
    
    // Clear all settings (rarely used - for resetting app)
    clearSettings(state) {
      state.settingsObject = {};
      localStorage.removeItem("settingsObject");
    },
  },
});

export const {
  setSettingsObject,
  updateSetting,
  loadSettings,
  setSettingsLoading,
  setSettingsError,
  clearSettings,
} = settingsSlice.actions;

export default settingsSlice.reducer;