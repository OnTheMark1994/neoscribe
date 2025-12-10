import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setAnonId, setAuthId, setDeviceId, setUser, setAvailableTokens } from '../store/userSlice';
import {
  loadAllSettings,
  setIsAIEnabled,
  setDeveloperMode,
  setBackgroundImage,
  setShowPreviewBar,
  setEditorViewMode,
} from '../store/settingsSlice';
import { fileOpened } from '../store/editorSlice';
import { setLoadingVisible, openUnsavedDialog } from '../store/uiSlice';
import { fetchUserAccount, fetchUserTokens, normalizeUserTokenData } from '../utils/aiService';
import { isElectron, isWeb, getWebAnonId } from '../utils/environment';
import { setBackground, loadSavedBackground } from '../utils/backgroundHelper';
import * as fileOps from '../utils/fileOps';
import { parseText } from '../utils/editorEngine';

/**
 * AppInitializer - Handles ALL initialization logic in one place
 * 
 * Purpose: Move all init logic from App.js useEffect hooks to a dedicated component.
 * This makes App.js declarative and keeps initialization concerns separated.
 * 
 * Responsibilities:
 * 1. Load anonId (Electron or web)
 * 2. Load deviceId (Electron only)
 * 3. Load authId from localStorage
 * 4. Dispatch IDs to Redux
 * 5. Fetch user account data from API
 * 6. Calculate and set availableTokens
 * 7. Load all settings from localStorage → dispatch to settingsSlice
 * 8. Load background image
 * 9. Set up Electron event listeners
 * 10. Hide loading screen when done
 * 
 * Display: None (returns null)
 */
function AppInitializer() {
  const dispatch = useDispatch();
  const anonId = useSelector(state => state.user.anonId);
  const deviceId = useSelector(state => state.user.deviceId);
  const authId = useSelector(state => state.user.authId);

  // Initial setup on mount
  useEffect(() => {
    // Load all settings from localStorage into Redux
    dispatch(loadAllSettings());

    // Load saved background
    loadSavedBackground();

    // Load saved authId from localStorage
    try {
      const savedAuthId = localStorage.getItem('authId');
      if (savedAuthId) {
        console.log('[INIT] Loaded authId from localStorage:', savedAuthId);
        dispatch(setAuthId(savedAuthId));
      }
    } catch (e) {
      // Ignore storage errors
    }

    // Get anon_id from Electron or generate for web
    if (isElectron()) {
      // Request anonId from Electron
      window.electronAPI.getAnonId().then(id => {
        console.log('[INIT] Received anon_id:', id);
        dispatch(setAnonId(id));
      });

      // Get device_id for per-device token grants (desktop only)
      window.electronAPI.getDeviceId().then(id => {
        console.log('[INIT] getDeviceId() resolved with:', id ? '(set)' : '(null)');
        dispatch(setDeviceId(id));
      }).catch(err => {
        console.error('[INIT] getDeviceId() failed:', err);
        dispatch(setDeviceId(null));
      });
    } else {
      // Web mode: generate anon_id from localStorage
      const webAnonId = getWebAnonId();
      console.log('[INIT] Using web anon_id:', webAnonId);
      dispatch(setAnonId(webAnonId));
      // Web mode has no deviceId
      dispatch(setDeviceId(undefined));
    }

    // Load last opened file (Electron only)
    const lastFile = localStorage.getItem('lastOpenedFile');
    if (lastFile && isElectron()) {
      fileOps.openFileByPath(lastFile)
        .then(result => {
          if (result && result.success) {
            console.log('[INIT] Loaded last file:', result.filePath);
            dispatch(fileOpened({ filePath: result.filePath, content: result.content }));
            parseText(result.content); // Initialize editorEngine for array view
          } else {
            console.log('[INIT] Failed to load last file');
            localStorage.removeItem('lastOpenedFile');
          }
        })
        .catch(err => {
          console.log('[INIT] Could not load last file:', err);
          localStorage.removeItem('lastOpenedFile');
        });
    }

    // Hide loading screen after initial setup
    // The actual data loading will happen in the next useEffect when anonId is available
    setTimeout(() => {
      dispatch(setLoadingVisible(false));
    }, 500);
  }, [dispatch]);

  // Set up Electron event listeners
  useEffect(() => {
    if (!isElectron()) return;

    // Listen for anonId ready event
    window.electronAPI.onAnonIdReady((event, id) => {
      console.log('[INIT] anon_id ready:', id);
      dispatch(setAnonId(id));
    });

    // Listen for deviceId ready event
    window.electronAPI.onDeviceIdReady((event, id) => {
      console.log('[INIT] device-id-ready event:', id ? '(set)' : '(null)');
      dispatch(setDeviceId(id));
    });

    // Listen for AI enabled changes from menu
    window.electronAPI.onAIEnabledChanged((event, enabled) => {
      console.log('[INIT] AI enabled changed:', enabled);
      dispatch(setIsAIEnabled(!!enabled));
    });

    // Toggle AI tool from menu
    if (!window.__scribeFoldToggleAIRegistered) {
      window.__scribeFoldToggleAIRegistered = true;
      window.electronAPI.onToggleAITool(() => {
        console.log('[INIT] Toggle AI tool requested');
        // Get current state and toggle
        const current = localStorage.getItem('aiEnabled') !== 'false';
        dispatch(setIsAIEnabled(!current));
      });
    }

    // Background theme handling
    window.electronAPI.onSetBackground((event, imagePath) => {
      setBackground(imagePath);
      dispatch(setBackgroundImage(imagePath));
    });

    // Listen for settings updates from settings window
    window.electronAPI.onSettingsUpdated((event, settings) => {
      if (settings.backgroundImage !== undefined) {
        setBackground(settings.backgroundImage);
        dispatch(setBackgroundImage(settings.backgroundImage));
      }
      if (settings.aiEnabled !== undefined) {
        console.log('[INIT] Settings updated - AI enabled:', settings.aiEnabled);
        dispatch(setIsAIEnabled(!!settings.aiEnabled));
      }
      if (settings.developerMode !== undefined) {
        console.log('[INIT] Settings updated - developer mode:', settings.developerMode);
        dispatch(setDeveloperMode(!!settings.developerMode));
      }
      if (settings.authId !== undefined) {
        const newAuthId = settings.authId || null;
        console.log('[INIT] Settings updated - authId:', newAuthId);
        dispatch(setAuthId(newAuthId));
        if (newAuthId) {
          try {
            localStorage.setItem('authId', newAuthId);
          } catch (e) {
            // Ignore storage errors
          }
        } else {
          try {
            localStorage.removeItem('authId');
          } catch (e) {
            // Ignore storage errors
          }
        }
      }
      if (settings.showPreviewBar !== undefined) {
        dispatch(setShowPreviewBar(!!settings.showPreviewBar));
      }
      if (settings.editorViewMode !== undefined) {
        dispatch(setEditorViewMode(settings.editorViewMode));
      }
      if (settings.requestCloseAfterSave) {
        window.close();
      }
    });

    // Listen for unsaved changes dialog
    if (window.electronAPI.onShowUnsavedChangesDialog) {
      window.electronAPI.onShowUnsavedChangesDialog(() => {
        dispatch(openUnsavedDialog());
      });
    }
  }, [dispatch]);

  // Fetch user account data once anonId is available
  useEffect(() => {
    if (!anonId) return;
    // In Electron, wait for deviceId to be set (can be undefined if not in Electron)
    if (isElectron() && deviceId === null) {
      // deviceId hasn't been set yet, wait for it
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        console.log('[INIT] Calling fetchUserAccount with:', {
          anonId,
          deviceId: deviceId ? '(set)' : '(none)',
        });

        const data = await fetchUserAccount(anonId, deviceId);
        if (cancelled) return;

        console.log('[INIT] User account data loaded:', {
          anonId,
          userId: data?.id,
          authId: data?.auth_id || data?.authId || null,
        });

        dispatch(setUser(data || null));

        // Sync authId from backend
        if (data && (data.authId || data.auth_id)) {
          const newAuthId = data.authId || data.auth_id;
          console.log('[INIT] Synching authId from backend:', newAuthId);
          dispatch(setAuthId(newAuthId));
          try {
            localStorage.setItem('authId', newAuthId);
          } catch (e) {
            // Ignore storage errors
          }
        } else if (authId) {
          // Backend says there is no auth linked, but we had one in memory.
          console.log('[INIT] Clearing stale authId');
          dispatch(setAuthId(null));
          try {
            localStorage.removeItem('authId');
          } catch (e) {
            // Ignore storage errors
          }
        }

        // After user ensure, load authoritative token stats
        try {
          const backendAuthId = data && (data.authId || data.auth_id) ? (data.authId || data.auth_id) : null;
          const tokenData = await fetchUserTokens(anonId, backendAuthId);
          const normalized = normalizeUserTokenData(tokenData || {});
          const initialAvailable = normalized.availableTokens > 0 ? normalized.availableTokens : 0;
          console.log('[INIT] Initial availableTokens from backend:', initialAvailable);
          if (!cancelled) {
            dispatch(setAvailableTokens(initialAvailable));
          }
        } catch (tokenErr) {
          if (!cancelled) {
            console.error('[INIT] Failed to load initial tokens:', tokenErr);
          }
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[INIT] Failed to load user account data:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [anonId, deviceId, authId, dispatch]);

  // Expose isModified to window for Electron's beforeunload checks
  useEffect(() => {
    // This is handled by the editorSlice setIsModified action now
  }, []);

  // No UI rendered - this is a logic-only component
  return null;
}

export default AppInitializer;
