import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Window from '../Util/Window';
import { setShowFileEncryptionWindow } from '../../Global/ReduxSlices/WindowSlice';
import { fileOpened, setModified } from '../../Global/ReduxSlices/EditorSlice';
import { setMonacoEditorContent } from '../Editors/EditorMonaco/MonacoFunctions';
import {
  decryptAndOpenEncryptedText,
  encryptAndSaveFile,
} from '../../Global/FileIO';
import './FileEncryptionWindow.css';

export default function FileEncryptionWindow({ monacoEditorRef }) {
  const dispatch = useDispatch();

  const open = useSelector(state => state.windowSlice.showFileEncryptionWindow);
  const mode = useSelector(state => state.windowSlice.fileEncryptionMode);
  const encryptedText = useSelector(state => state.windowSlice.fileEncryptionEncryptedText);
  const filePathFromState = useSelector(state => state.windowSlice.fileEncryptionFilePath);

  const filepath = useSelector(state => state.editorSlice.filepath);
  const fileName = useMemo(() => (filepath ? filepath.split(/[/\\]/).pop() : 'Untitled'), [filepath]);
  const fileNameBase = useMemo(() => {
    let name = String(fileName || 'Untitled');
    const lower = () => name.toLowerCase();
    const removable = ['.txt', '.md', '.markdown', '.scb'];
    let changed = true;
    while (changed) {
      changed = false;
      for (const ext of removable) {
        if (lower().endsWith(ext)) {
          name = name.slice(0, -ext.length);
          changed = true;
        }
      }
    }
    return name || 'Untitled';
  }, [fileName]);

  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const title = mode === 'unlock' ? 'Unlock Encrypted File' : 'Encrypt File';

  function close() {
    setPassword('');
    setError('');
    setWorking(false);
    dispatch(setShowFileEncryptionWindow(false));
  }

  async function handleEncrypt() {
    setError('');

    const pwd = String(password || '').trim();
    if (!pwd) {
      setError('Please enter a password or pin.');
      return;
    }

    const plaintext = monacoEditorRef?.current?.getValue ? monacoEditorRef.current.getValue() : '';
    const shouldOverwriteExistingScb = String(filepath || '').toLowerCase().endsWith('.scb');

    try {
      setWorking(true);
      const result = await encryptAndSaveFile({
        filePath: shouldOverwriteExistingScb ? (filepath || '') : '',
        fileName,
        plaintext,
        password: pwd,
        suggestedName: `${fileNameBase}.scb`,
      });

      if (!result?.success) {
        setError(result?.error || 'Encryption failed.');
        return;
      }

      if (result.filePath) dispatch(fileOpened({ filepath: result.filePath }));
      else if (result.fileName) dispatch(fileOpened({ filepath: result.fileName }));
      dispatch(setModified(false));
      close();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setWorking(false);
    }
  }

  async function handleUnlock() {
    setError('');

    const pwd = String(password || '').trim();
    if (!pwd) {
      setError('Please enter the password.');
      return;
    }

    const fp = String(filePathFromState || '');
    const enc = String(encryptedText || '');

    try {
      setWorking(true);
      const result = await decryptAndOpenEncryptedText({
        filePath: fp,
        encryptedText: enc,
        password: pwd,
      });

      if (!result?.success) {
        setError(result?.error || 'Incorrect password or file is corrupted.');
        return;
      }

      dispatch(fileOpened({ filepath: fp }));
      setMonacoEditorContent(monacoEditorRef, result.content);
      dispatch(setModified(false));
      close();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setWorking(false);
    }
  }

  return (
    <Window title={title} open={open} onClose={close} className="fileEncryptionWindow">
      <div className="fileEncryptionBody">
        {mode === 'encrypt' && (
          <div className="fileEncryptionWarning">
            <div className="fileEncryptionWarningTitle">Warning</div>
            <div className="fileEncryptionWarningText">
              This will encrypt the current file. If you lose the password, the file cannot be recovered.
            </div>
          </div>
        )}

        {mode === 'unlock' && (
          <div className="fileEncryptionWarning">
            <div className="fileEncryptionWarningTitle">Encrypted file</div>
            <div className="fileEncryptionWarningText">
              Enter the password to decrypt and open this file. The password is kept only for this session.
            </div>
          </div>
        )}

        <div className="fileEncryptionRow">
          <div className="fileEncryptionLabel">Password / PIN</div>
          <input
            className="fileEncryptionInput"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'unlock' ? 'Enter password' : 'Create password'}
            disabled={working}
          />
        </div>

        {error ? <div className="fileEncryptionError">{error}</div> : null}

        <div className="fileEncryptionButtons">
          <button type="button" onClick={close} disabled={working}>
            Close
          </button>
          {mode === 'unlock' ? (
            <button type="button" onClick={handleUnlock} disabled={working}>
              Open
            </button>
          ) : (
            <button type="button" onClick={handleEncrypt} disabled={working}>
              Encrypt
            </button>
          )}
        </div>
      </div>
    </Window>
  );
}
