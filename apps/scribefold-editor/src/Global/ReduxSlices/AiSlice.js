import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  aiModeActive: true,  // Determines if the ai chat window and other displays are shown
  messages: [],         // The array of messages that came in from the ai responses (also includes extended data for developer detail window)
  proposedChanges: [],  // The cumulative array of proposed chanages parsed from ai api respones
};

const aiSlice = createSlice({
  name: 'aiSlice',
  initialState,
  reducers: {
    // Sets the ai mode active and determines display of ai components
    setAiModeActive(state, action) {
      const next = action.payload;
      state.aiModeActive = typeof next === 'boolean' ? next : !state.aiModeActive;
    },
    // Add a message to the messages array (todo: we may need to add some data when the message sends and add to that when the resopnse is recieved)
    addMessage(state, action) {
      state.messages.push(action.payload);
    },
    // Clear the array of messages
    clearMessages(state) {
      state.messages = [];
    },
    // Adds to the proposed changes array
    addProposedChanges(state, action) {
      state.proposedChanges.push(action.payload);
    },
  },
});

export const { setAiModeActive, addMessage, clearMessages } = aiSlice.actions;

export default aiSlice.reducer;
