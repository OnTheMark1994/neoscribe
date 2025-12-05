import { createSlice } from '@reduxjs/toolkit';

const aiChangesSlice = createSlice({
  name: 'aiChanges',
  initialState: {
    allChangeIds: [],
    currentChangeIdIndex: 0,
    processedChangesByLineID: null,
    autoAdvanceOnResolve: true,
  },
  reducers: {
    setAIChanges: (state, action) => {
      const { allChangeIds, processedChanges } = action.payload;
      state.allChangeIds = allChangeIds;
      state.processedChangesByLineID = processedChanges;
      state.currentChangeIdIndex = 0;
    },
    clearAIChanges: (state) => {
      state.allChangeIds = [];
      state.currentChangeIdIndex = 0;
      state.processedChangesByLineID = null;
      // Preserve autoAdvanceOnResolve across sessions; do not reset here
    },
    nextChange: (state) => {
      if (state.currentChangeIdIndex < state.allChangeIds.length - 1) {
        state.currentChangeIdIndex++;
      }
    },
    previousChange: (state) => {
      if (state.currentChangeIdIndex > 0) {
        state.currentChangeIdIndex--;
      }
    },
    rebuildChangeIds: (state, action) => {
      // Rebuild allChangeIds from lines array
      const lines = action.payload;
      state.allChangeIds = [];
      lines.forEach(line => {
        if (line.proposedChangeId) {
          state.allChangeIds.push(line.proposedChangeId);
        }
      });
      // Adjust current index if needed
      if (state.currentChangeIdIndex >= state.allChangeIds.length) {
        state.currentChangeIdIndex = Math.max(0, state.allChangeIds.length - 1);
      }
    },
    setAutoAdvanceOnResolve: (state, action) => {
      state.autoAdvanceOnResolve = !!action.payload;
    },
    toggleAutoAdvanceOnResolve: (state) => {
      state.autoAdvanceOnResolve = !state.autoAdvanceOnResolve;
    },
    clearCurrentChangeSelection: (state) => {
      state.currentChangeIdIndex = -1;
    }
  }
});

export const { 
  setAIChanges, 
  clearAIChanges, 
  nextChange, 
  previousChange,
  rebuildChangeIds,
  setAutoAdvanceOnResolve,
  toggleAutoAdvanceOnResolve,
  clearCurrentChangeSelection,
} = aiChangesSlice.actions;

export default aiChangesSlice.reducer;
