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
import { useDispatch, useSelector } from 'react-redux';
import { fileOpened, setModified } from './ReduxSlices/EditorSlice';
import { setShowFileEncryptionWindow } from './ReduxSlices/WindowSlice';
import { openLastFile } from './FileIO';
import { setEditorText } from './EditorRefHelpers';
import { setAuthUser, setUserData, setUserDataLoading, triggerReloadUserData } from './ReduxSlices/UserSlice';
import { supabase } from './SupabaseClient';

const API_BASE_URL = process.env.REACT_APP_SCRIBEFOLD_API_BASE_URL || 'http://localhost:8080';

export default function AppInitializer({ editorRef }) {
  const dispatch = useDispatch();
  const authUser = useSelector(state => state.userSlice.authUser);
  const reloadUserDataTrigger = useSelector(state => state.userSlice.reloadUserDataTrigger);

  // Load user data from database
  async function loadUserData() {
    if (!authUser?.id) {
      console.log('[AppInitializer] No auth user, skipping user data load');
      return;
    }

    try {
      console.log('[AppInitializer] Loading user data for:', authUser.id);
      dispatch(setUserDataLoading(true));

      const response = await fetch(`${API_BASE_URL}/auth/user-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id }),
      });

      if (!response.ok) {
        console.error('[AppInitializer] Failed to load user data:', response.statusText);
        dispatch(setUserDataLoading(false));
        return;
      }

      const data = await response.json();
      console.log('[AppInitializer] User data loaded:', data);

      if (data.success && data.userData) {
        dispatch(setUserData(data.userData));
      } else {
        console.warn('[AppInitializer] No user data returned');
      }
    } catch (e) {
      console.error('[AppInitializer] Error loading user data:', e);
    } finally {
      dispatch(setUserDataLoading(false));
    }
  }

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    let authSubscription = null;

    // Initialize Supabase auth listener to persist sessions and sync to Redux
    async function initAuth() {
      try {
        if (!supabase) {
          console.warn('[AppInitializer] Supabase client not available');
          return;
        }

        // Set initial session user
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) {
          dispatch(setAuthUser(session?.user ?? null));
        }

        // Subscribe to auth state changes
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (cancelled) return;
          dispatch(setAuthUser(newSession?.user ?? null));
        });

        authSubscription = subscription;
      } catch (e) {
        // Non-fatal: editor still works in anonymous mode
        console.warn('[AppInitializer] Supabase auth init failed:', e?.message || e);
      }
    }

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

        const didSet = setEditorText(editorRef, content);
        if (!didSet) {
          let attempts = 0;
          intervalId = setInterval(() => {
            if (cancelled) {
              clearInterval(intervalId);
              intervalId = null;
              return;
            }

            attempts += 1;
            const ok = setEditorText(editorRef, content);
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

    initAuth();
    loadLastFile();
    loadUserData();

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      if (authSubscription) {
        try { authSubscription.unsubscribe(); } catch (_) {}
        authSubscription = null;
      }
    };
  }, [dispatch, editorRef]);

  // Load user data when auth user changes or reload is triggered
  useEffect(() => {
    loadUserData();
  }, [authUser?.id, reloadUserDataTrigger]);

  return (
    <div>
      
    </div>
  );
}
