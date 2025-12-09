import { configureStore } from '@reduxjs/toolkit';
import aiChangesReducer from './aiChangesSlice';
import userReducer from './userSlice';
import uiReducer from './uiSlice';
import editorReducer from './editorSlice';
import settingsReducer from './settingsSlice';

/**
 * Redux Store Configuration
 * 
 * Slices:
 * - user: User identity, authentication, and token state
 * - editor: Editor state (currentFilePath, isModified, viewMode)
 * - settings: All persistent settings synced with localStorage
 * - ui: Transient UI state (modals, loading screen)
 * - aiChanges: AI diff/change tracking
 */
export const store = configureStore({
  reducer: {
    user: userReducer,
    editor: editorReducer,
    settings: settingsReducer,
    ui: uiReducer,
    aiChanges: aiChangesReducer,
  },
});
