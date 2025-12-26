/*

  Stores state related to the editor
 
*/

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filepath: '',
  modified: false,
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
  },
});

export const { setFilepath, setModified, resetEditor, fileOpened } = editorSlice.actions;

export default editorSlice.reducer;