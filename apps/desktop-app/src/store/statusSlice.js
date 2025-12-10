import { createSlice } from '@reduxjs/toolkit';

/**
 * statusSlice - Redux slice for status bar messages
 * 
 * WHAT: Manages temporary status messages shown to user ("File saved successfully", errors, etc)
 * 
 * WHY REDUX NOT DOM:
 *   - WRONG: document.getElementById('status').textContent = 'message' (direct DOM manipulation)
 *   - RIGHT: dispatch(showStatus('message')) → Redux → StatusBar component displays
 *   - Benefits: Testable, trackable, fits React paradigm, no DOM coupling
 * 
 * HOW IT WORKS:
 *   1. Component dispatches showStatus('message')
 *   2. Redux updates state with { message, timestamp }
 *   3. StatusBar component reads from Redux, displays message
 *   4. StatusBar useEffect sets timeout to auto-clear after 3 seconds
 *   5. Timeout dispatches clearStatus() → message disappears
 * 
 * WHY TIMESTAMP:
 *   - If same message dispatched twice, timestamp changes → triggers useEffect
 *   - Without timestamp, React wouldn't know message changed if text is same
 *   - Example: User saves twice quickly, both should show feedback
 * 
 * WHO USES:
 *   - Editor: File save success/error messages
 *   - AISidebar: AI request success/error messages
 *   - Any component that needs to show temporary user feedback
 */

const initialState = {
  // WHAT: Current status message to display (or null if none)
  // UPDATED BY: Any component via showStatus action
  // READ BY: StatusBar component to display message
  message: null,
  
  // WHAT: Timestamp when message was set (milliseconds since epoch)
  // WHY: Forces React to re-render even if message text is same
  // USAGE: StatusBar useEffect depends on this to restart auto-clear timer
  timestamp: null,
};

const statusSlice = createSlice({
  name: 'status',
  initialState,
  reducers: {
    // WHAT: Sets a new status message to display
    // WHEN: Component wants to show user feedback (save success, error, etc)
    // PAYLOAD: String message to display
    // AUTO-CLEAR: StatusBar component will clear after 3 seconds
    showStatus(state, action) {
      state.message = action.payload;
      state.timestamp = Date.now();
    },
    
    // WHAT: Clears the current status message
    // WHEN: Called by StatusBar's auto-clear timeout, or manually by component
    // RESULT: StatusBar disappears
    clearStatus(state) {
      state.message = null;
      state.timestamp = null;
    },
  },
});

export const { showStatus, clearStatus } = statusSlice.actions;

// WHAT: Returns current status message (string or null)
// USAGE: const message = useSelector(selectStatusMessage)
export const selectStatusMessage = (state) => state.status.message;

// WHAT: Returns timestamp when message was set (number or null)
// USAGE: StatusBar useEffect depends on this to restart timer
export const selectStatusTimestamp = (state) => state.status.timestamp;

export default statusSlice.reducer;
