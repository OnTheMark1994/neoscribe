/*
 
 
  */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateSetting } from '../../../Global/ReduxSlices/SettingsSlice';
import { toggleFullscreenActive } from '../../../Global/ReduxSlices/MenuSlice';
import ToggleSwitch from '../../Util/ToggleSwitch';
import ColorPickerRow from './SettingsOptions/ColorPickerRow';
import { DEFAULT_COLORS, PRESETS } from './SettingsOptions/constants';
import './SettingsTabs.css';

export default function SettingsDisplay() {
  const dispatch = useDispatch();

  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);
  const backgroundImageUri = settingsObject?.backgroundImageUri;
  const customBackgroundImage = settingsObject?.customBackgroundImage;
  const spellcheckEnabled = settingsObject?.spellcheckEnabled !== false;
  const lineWrapEnabled = settingsObject?.lineWrapEnabled === true;
  const fullscreenActive = useSelector(state => state.menuSlice.fullscreenActive);
  const indentMarkersEnabled = settingsObject?.indentMarkersEnabled === true;
  const smartTabEnabled = settingsObject?.smartTabEnabled !== false;

  const themes = [
    { label: 'Space Dreams', value: '/theme-images/spacedreams.jpg' },
    { label: 'Mountains', value: '/theme-images/Mountains.png' },
    { label: 'Bitter Skies', value: '/theme-images/bitterskies.jpg' },
    { label: 'Enchantment', value: '/theme-images/enchantment.jpg' },
    { label: 'Spy Games', value: '/theme-images/spygames.jpg' },
    { label: 'Tranquility', value: '/theme-images/tranquility.jpg' },
    { label: 'Writing Desk', value: '/theme-images/writingdesk.jpg' },
  ];

  // Using a base 64 string for the image, maybe better to use a url or file path, some tradeoffs though: browser can't access real file path so will be gone on refresh, string has file size limits though  
  const handleCustomImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target.result;
      dispatch(updateSetting({ key: 'customBackgroundImage', value: base64String }));
      dispatch(updateSetting({ key: 'backgroundImageUri', value: 'custom' }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomImage = () => {
    dispatch(updateSetting({ key: 'customBackgroundImage', value: null }));
    dispatch(updateSetting({ key: 'backgroundImageUri', value: '/theme-images/spacedreams.jpg' }));
  };

  return (
    <div>
      <div className="settingsSection">
        <div className="settingsSectionTitle">Theme</div>
        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Background</div>
            <div className="settingsRowLabelSub">Choose a background theme for the editor.</div>
          </div>
        </div>

        <div className="settingsPillRow">
          {themes.map(theme => (
            <button
              key={theme.value}
              type="button"
              className={`settingsPill ${backgroundImageUri === theme.value ? 'settingsPillSelected' : ''}`}
              onClick={() => dispatch(updateSetting({ key: 'backgroundImageUri', value: theme.value }))}
            >
              {theme.label}
            </button>
          ))}
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Custom background</div>
            <div className="settingsRowLabelSub">Upload your own background image.</div>
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleCustomImageUpload}
              style={{ display: 'none' }}
              id="customBackgroundInput"
            />
            <button
              type="button"
              className="settingsButton"
              onClick={() => document.getElementById('customBackgroundInput').click()}
            >
              Upload Image
            </button>
            {customBackgroundImage && (
              <button
                type="button"
                className="settingsButton"
                onClick={handleRemoveCustomImage}
                style={{ marginLeft: '8px' }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Editor</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Line wrap</div>
            <div className="settingsRowLabelSub">Wrap long lines instead of scrolling horizontally</div>
          </div>
          <ToggleSwitch
            on={lineWrapEnabled}
            onClick={() => dispatch(updateSetting({ key: 'lineWrapEnabled', value: !lineWrapEnabled }))}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Full screen</div>
            <div className="settingsRowLabelSub">Toggle full screen mode (F11)</div>
          </div>
          <ToggleSwitch
            on={fullscreenActive}
            onClick={() => dispatch(toggleFullscreenActive())}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Enable spellcheck</div>
            <div className="settingsRowLabelSub">Underline misspelled words in the editor.</div>
          </div>
          <ToggleSwitch
            on={spellcheckEnabled}
            onClick={() => dispatch(updateSetting({ key: 'spellcheckEnabled', value: !spellcheckEnabled }))}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Smart Tab</div>
            <div className="settingsRowLabelSub">Tab to next tab stop instead of always adding 2 spaces</div>
          </div>
          <ToggleSwitch
            on={smartTabEnabled}
            onClick={() => dispatch(updateSetting({ key: 'smartTabEnabled', value: !smartTabEnabled }))}
          />
        </div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Show indent markers</div>
            <div className="settingsRowLabelSub">Show vertical lines indicating indentation depth.</div>
          </div>
          <ToggleSwitch
            on={indentMarkersEnabled}
            onClick={() => dispatch(updateSetting({ key: 'indentMarkersEnabled', value: !indentMarkersEnabled }))}
          />
        </div>
      </div>

      <div className="settingsSection">
        <div className="settingsSectionTitle">Color Selectors</div>

        <div className="settingsRow">
          <div className="settingsRowLabel">
            <div className="settingsRowLabelTitle">Presets</div>
            <div className="settingsRowLabelSub">Quickly apply common display combinations.</div>
          </div>
          <div className="colorPresets">
            <button
              type="button"
              className="settingsButton presetButton"
              onClick={() => {
                dispatch(updateSetting({ key: 'textColor', value: PRESETS.preset1.textColor }));
                dispatch(updateSetting({ key: 'pageBgColor', value: PRESETS.preset1.pageBgColor }));
              }}
            >
              Paper
            </button>
            <button
              type="button"
              className="settingsButton presetButton"
              onClick={() => {
                dispatch(updateSetting({ key: 'textColor', value: PRESETS.preset2.textColor }));
                dispatch(updateSetting({ key: 'pageBgColor', value: PRESETS.preset2.pageBgColor }));
              }}
            >
              Glass
            </button>
          </div>
        </div>

        <ColorPickerRow
          label="Indent marker"
          subLabel="Color of the indent guide lines when cursor is not on the line."
          settingKey="indentMarkerColor"
          defaultValue={DEFAULT_COLORS.indentMarkerColor}
        />

        <ColorPickerRow
          label="Indent marker active"
          subLabel="Color of the indent guide when cursor is on the line."
          settingKey="indentMarkerColorActive"
          defaultValue={DEFAULT_COLORS.indentMarkerColorActive}
        />

        <ColorPickerRow
          label="Text color"
          subLabel="Color of the editor text."
          settingKey="textColor"
          defaultValue={DEFAULT_COLORS.textColor}
        />

        <ColorPickerRow
          label="Page background"
          subLabel="Background color for the editor page."
          settingKey="pageBgColor"
          defaultValue={DEFAULT_COLORS.pageBgColor}
        />
      </div>
    </div>
  );
}
