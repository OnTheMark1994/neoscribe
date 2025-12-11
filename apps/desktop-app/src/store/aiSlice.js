import { createSlice } from '@reduxjs/toolkit';

/**
 * AI Proposals Redux Slice
 * Manages AI-suggested changes keyed by line IDs
 * Each proposal has: id, type (modify/insert/delete), content
 */

const initialState = {
  aiProposals: {}, // { [lineId]: Proposal[] }
  activeChangeId: null,
};

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setProposals: (state, { payload }) => {
      // Merge new proposals with existing ones
      state.aiProposals = { ...state.aiProposals, ...payload };
      
      // Auto-select the first proposal if none is selected
      if (!state.activeChangeId && Object.keys(payload).length > 0) {
        const firstLineId = Object.keys(payload)[0];
        const firstProposalArray = payload[firstLineId];
        if (Array.isArray(firstProposalArray) && firstProposalArray.length > 0) {
          state.activeChangeId = firstProposalArray[0].id;
        }
      }
    },
    clearProposalForId: (state, { payload: lineId }) => {
      delete state.aiProposals[lineId];
    },
    acceptAllProposals: (state) => {
      state.aiProposals = {};
      state.activeChangeId = null;
    },
    rejectAllProposals: (state) => {
      state.aiProposals = {};
      state.activeChangeId = null;
    },
    setActiveChangeId: (state, { payload }) => {
      state.activeChangeId = payload;
    },
  },
});

export const {
  setProposals,
  clearProposalForId,
  acceptAllProposals,
  rejectAllProposals,
  setActiveChangeId,
} = aiSlice.actions;

// Selectors
export const selectAiProposals = (state) => state.ai.aiProposals;
export const selectActiveChangeId = (state) => state.ai.activeChangeId;

// Flatten proposals to array for navigation
export const selectFlattenedChanges = (state) => {
  const proposals = state.ai.aiProposals;
  const changes = [];
  
  Object.entries(proposals).forEach(([lineId, proposalArray]) => {
    if (Array.isArray(proposalArray)) {
      proposalArray.forEach((proposal) => {
        changes.push({
          ...proposal,
          lineID: lineId,
        });
      });
    }
  });
  
  return changes;
};

export default aiSlice.reducer;
