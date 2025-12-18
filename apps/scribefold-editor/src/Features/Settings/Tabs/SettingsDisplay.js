/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import ToggleSwitch from '../../Util/ToggleSwitch';
import '../SettingsTabs.css';

export default function SettingsDisplay() {
  const dispatch = useDispatch();

  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const showArrayLineNumbers = settingsObject?.showArrayLineNumbers !== false;
  const showMonacoLineNumbers = settingsObject?.showMonacoLineNumbers !== false;
  const monacoStickyTopBar = settingsObject?.monacoStickyTopBar !== false;
  const showPreviewBar = settingsObject?.showPreviewBar !== false;

  return (
    <div>
      <div className="settingsSection">
        <div className="settingsSectionTitle">Array View</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Show line indexes</div>
            <div className="settingsRowLabelSub">Display line index numbers in the Array editor.</div>
          </div>
          <ToggleSwitch
            on={showArrayLineNumbers}
            onClick={() => dispatch(updateSetting({ key: 'showArrayLineNumbers', value: !showArrayLineNumbers }))}
          />
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Monaco View</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Sticky top bar</div>
            <div className="settingsRowLabelSub">Keep the current header pinned while scrolling.</div>
          </div>
          <ToggleSwitch
            on={monacoStickyTopBar}
            onClick={() => dispatch(updateSetting({ key: 'monacoStickyTopBar', value: !monacoStickyTopBar }))}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Show line indexes</div>
            <div className="settingsRowLabelSub">Show line numbers in the Monaco editor gutter.</div>
          </div>
          <ToggleSwitch
            on={showMonacoLineNumbers}
            onClick={() => dispatch(updateSetting({ key: 'showMonacoLineNumbers', value: !showMonacoLineNumbers }))}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Show preview bar</div>
            <div className="settingsRowLabelSub">Show the right-side preview panel.</div>
          </div>
          <ToggleSwitch
            on={showPreviewBar}
            onClick={() => dispatch(updateSetting({ key: 'showPreviewBar', value: !showPreviewBar }))}
          />
        </div>
      </div>
    </div>
  );
}
