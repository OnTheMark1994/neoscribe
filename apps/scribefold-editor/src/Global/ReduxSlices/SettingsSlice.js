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

*/

 import { createSlice } from '@reduxjs/toolkit';

 const defaultSettingsObject = {
    backgroundImageUri: '/theme-images/spacedreams.jpg',      // The image that shows as the background of the entire application 
    devMode: true, 
  };

 const initialState = {
   settingsObject: defaultSettingsObject,
 };

 const settingsSlice = createSlice({
   name: 'settingsSlice',
   initialState,
   reducers: {
     setSettingsObject(state, action) {
       state.settingsObject = action.payload ?? defaultSettingsObject;
     },
     updateSetting(state, action) {
       const { key, value } = action.payload || {};
       if (!key) return;
       state.settingsObject = {
         ...state.settingsObject,
         [key]: value,
       };
     },
     resetSettings(state) {
       state.settingsObject = defaultSettingsObject;
     },
   },
 });

 export const { setSettingsObject, updateSetting, resetSettings } = settingsSlice.actions;

 export default settingsSlice.reducer;
