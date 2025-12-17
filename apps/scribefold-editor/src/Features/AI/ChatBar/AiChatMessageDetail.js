/*
  AiChatMessageDetail

  Developer-only window used to inspect a full chat message object.

  How it opens:
    - AiChatMessage renders a "+" button when developer mode is enabled.
    - Clicking it dispatches `setMessageDetailDisplayData(message)` which stores the message object in `windowSlice.messageDetailData`.

  What it shows:
    - A pretty-printed JSON view of that message object (useful for inspecting raw/parsed API payloads later).
*/
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Window from '../../Util/Window';
import { setMessageDetailDisplayData } from '../../../Global/ReduxSlices/WindowSlice';
import './AiChatMessageDetail.css';

export default function AiChatMessageDetail() {
  // Used to close this window.
  const dispatch = useDispatch();

  // This is set when the user clicks the "+" button on a message.
  const messageDetailData = useSelector(state => state.windowSlice.messageDetailData);

  return (
    <Window
      title="Message Details"
      // Window is open whenever there is message detail data in redux.
      open={Boolean(messageDetailData)}
      // Clears the stored data so the window closes.
      onClose={() => dispatch(setMessageDetailDisplayData(null))}
    >
      <div className="aiChatMessageDetail">
        <pre className="aiChatMessageDetailPre">
          {/* Pretty JSON (2-space indentation) for easy reading/copying. */}
          {JSON.stringify(messageDetailData, null, 2)}
        </pre>
      </div>
    </Window>
  );
}
