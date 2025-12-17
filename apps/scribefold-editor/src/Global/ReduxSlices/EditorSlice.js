/*

  Stores state related to the editor
 
*/

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  content: '',
  filepath: '',
  modified: false,
};

const editorSlice = createSlice({
  name: 'editorSlice',
  initialState,
  reducers: {
    setContent(state, action) {
      state.content = action.payload ?? '';
    },
  },
});

export const { setContent, setProposedChanges, clearProposedChanges } = editorSlice.actions;

export default editorSlice.reducer;