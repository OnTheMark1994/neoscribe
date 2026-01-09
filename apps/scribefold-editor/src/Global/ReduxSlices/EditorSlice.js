/*

  Stores state related to the editor
 
*/

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filepath: '',
  modified: false,
  showDiffView: false,
};

const editorSlice = createSlice({
  name: 'editorSlice',
  initialState,
  reducers: {
    setFilepath(state, action) {
      state.filepath = action.payload ?? '';
    },
    setModified(state, action) {
      state.modified = !!action.payload;
    },
    resetEditor(state) {
      state.filepath = '';
      state.modified = false;
    },
    fileOpened(state, action) {
      const { filepath } = action.payload || {};
      state.filepath = filepath ?? '';
      state.modified = false;
    },
    toggleShowDiffView(state) {
      state.showDiffView = !state.showDiffView;
    },
    setShowDiffView(state, action) {
      state.showDiffView = !!action.payload;
    },
  },
});

export const { setFilepath, setModified, resetEditor, fileOpened, toggleShowDiffView, setShowDiffView } = editorSlice.actions;

export default editorSlice.reducer;