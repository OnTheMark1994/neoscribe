import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import WindowMoveable from '../Util/WindowMoveable';
import Keyboard from '../Util/Keyboard';
import { updateSetting } from '../../Global/ReduxSlices/SettingsSlice';
import { handleMiniKeyboardMonacoKeyPress } from '../Editors/EditorMonaco/MonacoFunctions';

export default function KeyboardWindow({ monacoEditorRef }) {
  const dispatch = useDispatch();
  const showMiniKeyboard = useSelector(state => state.settingsSlice.settingsObject?.showMiniKeyboard === true);

  if (!showMiniKeyboard) return null;

  return (
    <WindowMoveable
      title="Keyboard"
      open
      onClose={() => dispatch(updateSetting({ key: 'showMiniKeyboard', value: false }))}
      className="keyboardWindow"
      initialPosition={{ x: 30, y: 120 }}
    >
      <Keyboard onPress={(key) => handleMiniKeyboardMonacoKeyPress(monacoEditorRef, key)} />
    </WindowMoveable>
  );
}
