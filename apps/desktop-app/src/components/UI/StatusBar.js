import React, { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectStatusMessage, selectStatusTimestamp, clearStatus } from '../../store/statusSlice';

/**
 * StatusBar - Displays temporary status messages to user
 * 
 * WHAT: Bottom bar that shows temporary feedback messages ("File saved successfully", errors, etc)
 * 
 * WHY COMPONENT NOT JUST DIV:
 *   - Encapsulates auto-clear logic (setTimeout/clearTimeout)
 *   - Listens to Redux state changes automatically
 *   - Self-contained behavior (parent doesn't need to manage timeout)
 *   - WRONG OLD WAY: Direct DOM manipulation with document.getElementById('status')
 *   - RIGHT NEW WAY: Redux state → React component → declarative rendering
 * 
 * HOW AUTO-CLEAR WORKS:
 *   1. Component reads message and timestamp from Redux
 *   2. When timestamp changes (new message), useEffect runs
 *   3. useEffect sets 3-second timeout to dispatch clearStatus()
 *   4. If new message arrives before timeout, useEffect cleanup cancels old timeout
 *   5. New timeout starts for new message
 *   6. After 3 seconds of no new messages, clearStatus() is dispatched
 * 
 * WHY TIMESTAMP DEPENDENCY:
 *   - If user saves file twice quickly with same success message
 *   - Without timestamp: useEffect wouldn't re-run (same message text)
 *   - With timestamp: Each message has unique timestamp → useEffect runs → timer restarts
 *   - Result: User sees feedback for each action, not just first one
 * 
 * WHY CLEANUP:
 *   - Prevents memory leaks if component unmounts
 *   - Prevents stale timeouts from firing if new message arrives
 *   - Example: User sees error, then success quickly → error timeout cancelled, only success clears
 * 
 * STYLING:
 *   - Uses existing .status CSS class (no visual changes)
 *   - Empty string renders as empty div (preserves layout)
 *   - Could be enhanced with fade-in/out animations in CSS
 */
function StatusBar() {
  // WHAT: Redux dispatch to clear message after timeout
  const dispatch = useDispatch();
  
  // WHAT: Current message to display (string or null)
  // WHY: Main content of status bar
  const message = useSelector(selectStatusMessage);
  
  // WHAT: Timestamp when message was set (number or null)
  // WHY: Triggers useEffect to restart auto-clear timer
  // HOW: Even if message text is same, timestamp changes → useEffect runs
  const timestamp = useSelector(selectStatusTimestamp);
  
  // WHAT: Reference to timeout ID for auto-clear
  // WHY REF NOT STATE: Don't need re-render when timeout ID changes
  // USAGE: Clear timeout if new message arrives before 3 seconds
  const timeoutRef = useRef(null);
  
  // WHAT: Auto-clear timer - clears message after 3 seconds
  // WHY useEffect: Runs whenever timestamp changes (new message)
  // DEPENDENCIES: [timestamp, dispatch] - timestamp triggers re-run, dispatch is stable
  useEffect(() => {
    // If no message, no need for timeout
    if (!message) return;
    
    // Clear any existing timeout (if new message arrived before old one cleared)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Set new 3-second timeout to clear message
    timeoutRef.current = setTimeout(() => {
      dispatch(clearStatus());
      timeoutRef.current = null;
    }, 3000);
    
    // CLEANUP: Clear timeout if component unmounts or new message arrives
    // WHY: Prevents memory leaks and stale timeouts
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [timestamp, dispatch]); // timestamp triggers, dispatch is stable
  
  // WHAT: Render message or empty string
  // WHY: Preserves layout even when no message (div still exists)
  // CSS: Uses existing .status class for styling
  return (
    <div className="status">
      {message || ''}
    </div>
  );
}

export default StatusBar;
