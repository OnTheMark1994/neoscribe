import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  messages: [],         // The array of messages that came in from the ai responses (also includes extended data for developer detail window)
  proposedChanges: [],  // The cumulative array of proposed chanages parsed from ai api respones
};

const aiSlice = createSlice({
  name: 'aiSlice',
  initialState,
  reducers: {
    // Add a message to the messages array (todo: we may need to add some data when the message sends and add to that when the resopnse is recieved)
    addMessage(state, action) {
      // We treat "thinking" messages as temporary placeholders.
      // Any time a real message is added (user or assistant), remove all placeholders first.
      state.messages = state.messages.filter(m => !m?.thinking);
      state.messages.push(action.payload);
    },
    // Clear the array of messages
    clearMessages(state) {
      state.messages = [];
    },
    // Adds to the proposed changes array
    addProposedChanges(state, action) {
      const incoming = Array.isArray(action.payload) ? action.payload : [action.payload];

      for(const change of incoming){
        if(!change) continue;

        const type = change?.type;
        const lineID = change?.lineID ?? change?.lineId;

        if(type === 'modify' && lineID){
          const existingIndex = state.proposedChanges.findIndex(c =>
            c?.type === 'modify' && (c?.lineID ?? c?.lineId) === lineID
          );

          if(existingIndex !== -1){
            state.proposedChanges[existingIndex] = change;
            continue;
          }
        }

        state.proposedChanges.push(change);
      }
    },
  },
});

export const { addMessage, clearMessages, addProposedChanges } = aiSlice.actions;

export default aiSlice.reducer;
