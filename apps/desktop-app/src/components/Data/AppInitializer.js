import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * AppInitializer - Component for initializing and managing application state
 * 
 * Purpose: Handle all initialization logic including user data loading and settings loading
 * 
 * Key Functions:
 * 1. Load user data when auth state changes or reload is triggered
 * 2. Load settings from localStorage on app startup
 * 3. Centralized user data management with refresh capability
 * 
 * Note: This component doesn't render anything - it's purely for side effects
 */

// Import Redux actions
import {
  setUserData,
  setLoadingUserData,
  setUserError,
  reloadUserData
} from './redux/slices/userSlice';

import { loadSettings } from './redux/slices/settingsSlice';

// API URL constant
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const AppInitializer = () => {
  const dispatch = useDispatch();
  
  // Get all state needed for user data loading using direct state access
  const authUser = useSelector(state => state.user.authUser);
  const anonId = useSelector(state => state.user.anonId);
  const deviceId = useSelector(state => state.user.deviceId);
  const userDataReloadTrigger = useSelector(state => state.user.userDataReloadTrigger);
  const loadingUserData = useSelector(state => state.user.loadingUserData);

  /**
   * EFFECT 1: User Data Loading
   * 
   * Purpose: Load user data whenever identifiers change or reload is triggered
   * 
   * Triggers when:
   * - authUser changes (user logs in/out)
   * - anonId changes (anonymous session changes)
   * - deviceId changes (desktop app registration)
   * - userDataReloadTrigger increments (manual refresh)
   * 
   * Flow:
   * 1. Check if we have any identifier (auth, anon, or device)
   * 2. Set loading state to true
   * 3. Call API with all available identifiers
   * 4. Store result in Redux userData
   * 5. Set loading state to false
   * 
   * Note: Server decides which identifier to use (priority: auth_id > device_id > anon_id)
   */
  useEffect(() => {
    const fetchUserData = async () => {
      // Skip if no identifiers available
      if (!authUser?.id && !deviceId && !anonId) {
        return;
      }

      try {
        dispatch(setLoadingUserData(true));
        
        // Prepare request body with all available identifiers
        const requestBody = {
          ...(authUser?.id && { auth_id: authUser.id }),
          ...(deviceId && { device_id: deviceId }),
          ...(anonId && { anon_id: anonId }),
        };
        
        // Call custom API endpoint
        const response = await fetch(`${API_BASE_URL}/user-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const userData = await response.json();
        
        if (userData) {
          // Store user data in Redux for access across entire app
          dispatch(setUserData(userData));
          
          // Clear any previous errors
          dispatch(setUserError(null));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        
        // Store error in Redux for error handling in components
        dispatch(setUserError(error.message || 'Failed to load user data'));
      } finally {
        // Always set loading to false when done (success or error)
        dispatch(setLoadingUserData(false));
      }
    };

    fetchUserData();
    
    // Dependencies array - effect runs when any of these change
  }, [dispatch, authUser?.id, anonId, deviceId, userDataReloadTrigger]);

  /**
   * EFFECT 2: Settings Initialization
   * 
   * Purpose: Load settings from localStorage on app startup
   * 
   * Flow:
   * 1. Load settingsObject from localStorage
   * 2. Parse JSON (or use empty object if none exists)
   * 3. Dispatch loadSettings to populate Redux state
   * 
   * Note: Runs only once on component mount
   * Settings are automatically saved when changed via updateSetting action
   */
  useEffect(() => {
    // Load settings from localStorage into Redux state
    dispatch(loadSettings());
  }, [dispatch]);

  // This component doesn't render anything - it's purely for side effects
  return null;
};

export default AppInitializer;