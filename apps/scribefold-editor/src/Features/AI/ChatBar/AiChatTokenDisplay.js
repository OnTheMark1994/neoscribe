/*
  AiChatTokenDisplay

  Token usage header row shown near the top of the AI chat sidebar.

  What it shows:
    - Available tokens (from `userSlice.userData`)
    - Refresh button to trigger a user data reload (keeps all refresh buttons in sync)
    - A simple estimate of tokens used per prompt (placeholder for now)
    - Info button that opens the Help window to the AI/token usage section
*/
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { triggerReloadUserData } from '../../../Global/ReduxSlices/UserSlice';
import { setShowHelpWindow } from '../../../Global/ReduxSlices/WindowSlice';
import RefreshButton from '../../Util/RefreshButton';
import InfoButton from '../../Util/InfoButton';
import './AiChatTokenDisplay.css';

export default function AiChatTokenDisplay() {
  // Redux dispatch for refresh/help actions.
  const dispatch = useDispatch();

  // User data is the authoritative place for token balance in this app.
  const userData = useSelector(state => state.userSlice.userData);

  // Used to show a loading/spinning state on the refresh button.
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);

  // Support multiple token field names so we remain compatible with older/newer backend shapes.
  const tokens = userData?.tokens ?? userData?.token_balance ?? 0;

  // Display formatting (human readable with commas).
  const tokensDisplay = typeof tokens === 'number' ? tokens.toLocaleString() : '0';

  // Placeholder estimate; later this will use current editor contents + prompt size.
  const estimatedTokensPerPrompt = 0;

  // Match desktop-app display style (prefix with ~ to indicate it's an estimate).
  const estimatedTokensDisplay = typeof estimatedTokensPerPrompt === 'number'
    ? `~${estimatedTokensPerPrompt.toLocaleString()}`
    : '~0';

  return (
    <div className="aiChatTokenRow">
      <div className="aiChatTokenLine">
        <div className="aiChatTokenLineLeft">
          <div className="aiChatTokenLabel">Available Tokens</div>
        </div>
        <div className="aiChatTokenLineRight">
          <div className="aiChatTokenValue">{tokensDisplay}</div>
          <RefreshButton
            // When userSlice is loading, show the spinning state.
            loading={userDataLoading}
            title="Refresh"
            // Triggers a user data reload (shared across the app).
            onClick={() => dispatch(triggerReloadUserData())}
          />
        </div>
      </div>

      <div className="aiChatTokenLine">
        <div className="aiChatTokenLineLeft aiChatTokenLineLeftSub">
          Estimated used / prompt
        </div>
        <div className="aiChatTokenLineRight">
          <div className="aiChatTokenEstimate">{estimatedTokensDisplay}</div>
          <InfoButton
            title="Token usage help"
            // Opens the help window directly to the AI help section.
            onClick={() => dispatch(setShowHelpWindow('token-usage'))}
          />
        </div>
      </div>
    </div>
  );
}
