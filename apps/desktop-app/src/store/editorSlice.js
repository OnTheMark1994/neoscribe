import { createSlice } from '@reduxjs/toolkit';

/**
 * editorSlice - Manages editor-wide state
 * 
 * Purpose: Centralize editor state that was previously scattered across App.js and Editor.js
 * This eliminates prop drilling for currentFilePath, isModified, viewMode, etc.
 * 
 * Note: Document content is NOT stored here for performance reasons.
 * Content lives in editorEngine.js (lines array) and local component state.
 * Redux dispatch on every keystroke would be a performance problem.
 */

const initialState = {
  currentFilePath: null,        // Path of currently open file
  isModified: false,            // Document has unsaved changes
  viewMode: 'array',            // 'array' | 'monaco' | 'textarea'
  isArrayView: true,            // Array view style toggle
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    setCurrentFilePath(state, action) {
      state.currentFilePath = action.payload || null;
    },
    setIsModified(state, action) {
      state.isModified = !!action.payload;
      // Also expose to window for Electron's beforeunload checks
      if (typeof window !== 'undefined') {
        window.isModified = state.isModified;
      }
    },
    setViewMode(state, action) {
      const mode = action.payload;
      if (mode === 'array' || mode === 'monaco' || mode === 'textarea') {
        state.viewMode = mode;
      }
    },
    setIsArrayView(state, action) {
      state.isArrayView = !!action.payload;
    },
    resetEditor(state) {
      state.currentFilePath = null;
      state.isModified = false;
      // Keep viewMode and isArrayView as user preference
    },
    // Combined action for file open/new operations
    fileOpened(state, action) {
      const { filePath } = action.payload || {};
      state.currentFilePath = filePath || null;
      state.isModified = false;
    },
  },
});

export const {
  setCurrentFilePath,
  setIsModified,
  setViewMode,
  setIsArrayView,
  resetEditor,
  fileOpened,
} = editorSlice.actions;

// Selectors
export const selectCurrentFilePath = (state) => state.editor.currentFilePath;
export const selectIsModified = (state) => state.editor.isModified;
export const selectViewMode = (state) => state.editor.viewMode;
export const selectIsArrayView = (state) => state.editor.isArrayView;

export default editorSlice.reducer;
