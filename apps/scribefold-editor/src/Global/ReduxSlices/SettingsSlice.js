/*
 
  load settings action: 
    which pulls json from localStorage
    puts it in redux state to be used througout the application
    if none is foudn it uses a default json as defined here in a constant and puts it in local storage and state

  update setting action:
    takes the setting name and the new value
    pulls object from local storage
    updates the object
    saves the update object in local storage and state for use everywhere in the application

  rest to default action
    sets local storage and the global state to the default json as defined here in a constant 


mod the things a described in the ( areas


*/

 import { createSlice } from '@reduxjs/toolkit';

 // localStorage
 //
 // The settings slice is responsible for persisting user preferences between sessions.
 // We do that by storing the entire settings JSON object in localStorage.
 //
 // IMPORTANT: The keys used here should stay stable, because they are persisted.
 const SETTINGS_STORAGE_KEY = 'scribefold-editor-settingsObject';

 const defaultSettingsObject = {
    backgroundImageUri: '/theme-images/spacedreams.jpg',      // The image that shows as the background of the entire application
    devMode: true,
    showArrayLineNumbers: true,
    showMonacoLineNumbers: true,
    monacoStickyTopBar: true,
    showPreviewBar: true,
    aiModeActive: true,
    autoJumpToNextChunk: true,
  };

 // Saves the settings object to localStorage.
 // This fails silently if localStorage is unavailable.
 function saveSettingsObjectToLocalStorage(settingsObject) {
   try {
     localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settingsObject));
   } catch (error) {
     // No-op
   }
 }

 // Loads the settings object from localStorage.
 // If it doesn't exist (or is invalid), we seed localStorage with our defaults and return defaults.
 // When new settings are added to defaultSettingsObject, we merge them on top of any
 // previously saved settings so that new keys get sensible defaults.
 function loadSettingsObjectFromLocalStorage() {
    try {
      // Pull the data from localstorage
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      
      // If its not there (maybe on first load) put the default in localstorage and return the default
      if (!raw) {
        saveSettingsObjectToLocalStorage(defaultSettingsObject);
        return defaultSettingsObject;
      }

      // parse the string into json
      const parsed = JSON.parse(raw);
      // In case bad data in that location somehow
      if (!parsed || typeof parsed !== 'object') {
        saveSettingsObjectToLocalStorage(defaultSettingsObject);
        return defaultSettingsObject;
      }

      // Merge defaults with stored values so newly added settings
      // (like autoJumpToNextChunk) get their default values.
      const merged = { ...defaultSettingsObject, ...parsed };
      saveSettingsObjectToLocalStorage(merged);
      return merged;
    } catch (error) {
      // If JSON parsing fails (or localStorage is blocked), fall back to defaults.
      // We also try to seed defaults to localStorage so a later refresh can recover.
      saveSettingsObjectToLocalStorage(defaultSettingsObject);
      return defaultSettingsObject;
    }
 }

 const initialState = {
   // settingsObject is persisted in localStorage so it survives refresh/re-open.
   settingsObject: loadSettingsObjectFromLocalStorage(),
 };

 const settingsSlice = createSlice({
   name: 'settingsSlice',
   initialState,
   reducers: {
    // Should not be using this, use updateSetting
     setSettingsObject(state, action) {
       const nextSettingsObject = action.payload ?? defaultSettingsObject;
       state.settingsObject = nextSettingsObject;
       saveSettingsObjectToLocalStorage(nextSettingsObject);
     },
     updateSetting(state, action) {
       const { key, value } = action.payload || {};
       if (!key) return;

       // 1) Update redux state immediately for UI responsiveness.
       // 2) Persist the updated object to localStorage so it survives refresh.
       const nextSettingsObject = {
         ...state.settingsObject,
         [key]: value,
       };

       saveSettingsObjectToLocalStorage(nextSettingsObject);

       state.settingsObject = nextSettingsObject;
     },
     resetSettings(state) {
       // Reset both redux state and localStorage to our default settings.
       state.settingsObject = defaultSettingsObject;
       saveSettingsObjectToLocalStorage(defaultSettingsObject);
     },
   },
 });

 export const { setSettingsObject, updateSetting, resetSettings } = settingsSlice.actions;

 export default settingsSlice.reducer;
