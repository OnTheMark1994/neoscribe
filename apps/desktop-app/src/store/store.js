import { configureStore } from '@reduxjs/toolkit';
import aiChangesReducer from './aiChangesSlice';
import aiReducer from './aiSlice';
import userReducer from './userSlice';
import uiReducer from './uiSlice';
import editorReducer from './editorSlice';
import settingsReducer from './settingsSlice';
import statusReducer from './statusSlice';

/**
 * Redux Store Configuration
 * 
 * WHAT: Combines all Redux slices into single store
 * 
 * Slices:
 * - user: User identity, authentication, token state
 * - editor: Editor state (currentFilePath, isModified, viewMode)
 * - settings: All persistent settings synced with localStorage
 * - ui: Transient UI state (modals, loading screen)
 * - aiChanges: AI diff/change tracking for proposed edits
 * - status: Temporary status messages ("File saved", errors, etc)
 */
export const store = configureStore({
  reducer: {
    user: userReducer,
    editor: editorReducer,
    settings: settingsReducer,
    ui: uiReducer,
    aiChanges: aiChangesReducer,
    ai: aiReducer,
    status: statusReducer,
  },
});
