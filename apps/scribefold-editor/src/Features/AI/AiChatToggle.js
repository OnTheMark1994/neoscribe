import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../Global/ReduxSlices/SettingsSlice';
import AiEyeIcon from '../Editors/EditorMonaco/scribefold-ai-eye.png';
import './AiChatToggle.css';

export default function AiChatToggle() {
  const dispatch = useDispatch();
  const aiModeActive = useSelector(state => state.settingsSlice.settingsObject?.aiModeActive);
  const fullscreenActive = useSelector(state => state.menuSlice.fullscreenActive);

  if (aiModeActive || fullscreenActive) return null;

  return (
    <button
      className="aiChatToggle"
      onClick={() => dispatch(updateSetting({ key: 'aiModeActive', value: true }))}
      title="Show AI Chat"
    >
      <img src={AiEyeIcon} alt="Show AI Chat" className="aiChatToggleEye" />
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </button>
  );
}
