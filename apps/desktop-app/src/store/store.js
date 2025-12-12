import { configureStore } from '@reduxjs/toolkit';
import aiReducer from './aiSlice';
import aiChangesReducer from './aiChangesSlice';
import aiUiReducer from './aiUiSlice';
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
 * - editor: Editor state (currentFilePath, isModified, viewType)
 * - settings: All persistent settings synced with localStorage
 * - ui: Transient UI state (modals, loading screen)
 * - ai: AI proposals storage for Monaco (raw response from API)
 * - aiChanges: AI changes storage for EditorArray (line-embedded proposals)
 * - status: Temporary status messages ("File saved", errors, etc)
 */
export const store = configureStore({
  reducer: {
    user: userReducer,
    editor: editorReducer,
    settings: settingsReducer,
    ui: uiReducer,
    ai: aiReducer,
    aiChanges: aiChangesReducer,
    aiUi: aiUiReducer,
    status: statusReducer,
  },
});
