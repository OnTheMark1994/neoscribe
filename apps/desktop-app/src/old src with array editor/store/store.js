import { configureStore } from '@reduxjs/toolkit';
import aiChangesReducer from './aiChangesSlice';
import userReducer from './userSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    aiChanges: aiChangesReducer,
    user: userReducer,
    ui: uiReducer,
  },
});
