/*
  Combine the slices and provides access to them all in index.js
 
 */

 import { configureStore } from '@reduxjs/toolkit';
 import settingsSliceReducer from './ReduxSlices/SettingsSlice';
 import userSliceReducer from './ReduxSlices/UserSlice';
 import editorSliceReducer from './ReduxSlices/EditorSlice';
 import windowSliceReducer from './ReduxSlices/WindowSlice';
 import aiSliceReducer from './ReduxSlices/AiSlice';
 import menuSliceReducer from './ReduxSlices/MenuSlice';
 import tabsSliceReducer from './ReduxSlices/TabsSlice';

 const store = configureStore({
   reducer: {
     settingsSlice: settingsSliceReducer,
     userSlice: userSliceReducer,
     editorSlice: editorSliceReducer,
     windowSlice: windowSliceReducer,
     aiSlice: aiSliceReducer,
     menuSlice: menuSliceReducer,
     tabsSlice: tabsSliceReducer,
   },
 });

 export default store;
