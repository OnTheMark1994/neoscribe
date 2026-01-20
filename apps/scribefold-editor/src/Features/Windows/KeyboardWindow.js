import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import WindowMoveable from '../Util/WindowMoveable';
import Keyboard from '../Util/Keyboard';
import { updateSetting } from '../../Global/ReduxSlices/SettingsSlice';
import { backspaceAtCursor, insertTextAtCursor } from '../../Global/EditorRefHelpers';

export default function KeyboardWindow({ editorRef }) {
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
      <Keyboard
        onPress={(key) => {
          const k = String(key ?? '');
          if (!k) return;
          if (k === 'Backspace') {
            backspaceAtCursor(editorRef);
            return;
          }
          if (k === 'Enter') {
            insertTextAtCursor(editorRef, '\n');
            return;
          }
          insertTextAtCursor(editorRef, k);
        }}
      />
    </WindowMoveable>
  );
}
