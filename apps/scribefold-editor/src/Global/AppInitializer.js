/*
  Auth state listner
    puts supbase auth user object into redux
    sets a flag to show if it finished attempting to load this yet or not so other functions know what to do 

  user data loading
    loads the user data into the user data redux slice to be used all over the application
    called in useEffect that runs after the auth user object attempts to load 
      (so when the user object changes, when the attepmted auth loading flag changes, when the reload user data redux trigger changes)
      runs even if there is no auth user, but auth user check happens first
    uses a custom api that takes the auth id, device id, anon id all as params

  loading user data
    flag used show show if the user data is loading for display purposes 

  Other data
    if there is other data that loads on initilazation we will add it here
 
 */
import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fileOpened, setModified } from './ReduxSlices/EditorSlice';
import { setShowFileEncryptionWindow } from './ReduxSlices/WindowSlice';
import { openLastFile } from './FileIO';
import { setMonacoEditorContent } from '../Features/Editors/EditorMonaco/MonacoFunctions';

export default function AppInitializer({ monacoEditorRef }) {
  const dispatch = useDispatch();

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function loadLastFile() {
      try {
        const result = await openLastFile();
        if (cancelled) return;
        if (!result?.success) return;

        const content = String(result.content ?? '');
        const filepath = String(result.filePath || result.fileName || '');
        dispatch(fileOpened({ filepath }));

        if (result.encrypted) {
          dispatch(setShowFileEncryptionWindow({
            mode: 'unlock',
            filePath: filepath,
            encryptedText: String(result.encryptedText ?? ''),
          }));
          dispatch(setModified(false));
          return;
        }

        const didSet = setMonacoEditorContent(monacoEditorRef, content);
        if (!didSet) {
          let attempts = 0;
          intervalId = setInterval(() => {
            if (cancelled) {
              clearInterval(intervalId);
              intervalId = null;
              return;
            }

            attempts += 1;
            const ok = setMonacoEditorContent(monacoEditorRef, content);
            if (ok || attempts >= 50) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }, 100);
        }
        dispatch(setModified(false));
      } catch (e) {
        console.error('[AppInitializer] openLastFile failed', e);
      }
    }

    loadLastFile();
    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [dispatch]);

  return (
    <div>
      
    </div>
  );
}
