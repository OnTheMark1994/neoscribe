/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { clearMessages } from '../../../Global/ReduxSlices/AiSlice';
import ToggleSwitch from '../../Util/ToggleSwitch';
import '../SettingsTabs.css';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';

export default function SettingsAI() {
  const dispatch = useDispatch();
  const aiModeActive = useSelector(state => state.settingsSlice.settingsObject?.aiModeActive);

  return (
    <div>
      <div className="settingsSection">
        <div className="settingsSectionTitle">AI Chat</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Enable AI Chat bar</div>
            <div className="settingsRowLabelSub">Shows the AI sidebar and related AI UI.</div>
          </div>
          <ToggleSwitch on={Boolean(aiModeActive)} onClick={() => dispatch(updateSetting("aiModeActive", true))} />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Clear chat messages</div>
            <div className="settingsRowLabelSub">Removes all chat history from this session.</div>
          </div>
          <button type="button" className="settingsButton" onClick={() => dispatch(clearMessages())}>
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}
