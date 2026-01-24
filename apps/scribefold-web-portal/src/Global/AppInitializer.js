import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setAuthUser, setUserData, setUserDataLoading, triggerReloadUserData } from './ReduxSlices/UserSlice';
import { supabase } from './SupabaseClient';

export default function AppInitializer() {
  const dispatch = useDispatch();
  const authUser = useSelector(state => state.userSlice.authUser);
  const reloadUserDataTrigger = useSelector(state => state.userSlice.reloadUserDataTrigger);

  async function loadUserData() {
    if (!authUser?.id) {
      console.log('[AppInitializer] No auth user, skipping user data load');
      return;
    }

    try {
      console.log('[AppInitializer] Loading user data for:', authUser.id);
      dispatch(setUserDataLoading(true));

      const apiUrl = process.env.REACT_APP_API_URL;
      console.log('[AppInitializer] API URL:', apiUrl);
      console.log('[AppInitializer] Full URL:', `${apiUrl}/auth/user-data`);

      const response = await fetch(`${apiUrl}/auth/user-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: authUser.id }),
      });

      console.log('[AppInitializer] Response status:', response.status);
      console.log('[AppInitializer] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AppInitializer] Error response:', errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AppInitializer] User data loaded from API:', data);
      // Extract userData from response (API returns { success: true, userData: {...} })
      dispatch(setUserData(data.userData || data));
    } catch (e) {
      console.error('[AppInitializer] Error loading user data from API:', e);
      dispatch(setUserData(null));
    } finally {
      dispatch(setUserDataLoading(false));
    }
  }

  useEffect(() => {
    let cancelled = false;
    let authSubscription = null;

    (async () => {
      try {
        if (!supabase) {
          console.warn('[AppInitializer] Supabase client not available');
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) {
          dispatch(setAuthUser(session?.user ?? null));
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, newSession) => {
          if (cancelled) return;
          dispatch(setAuthUser(newSession?.user ?? null));
        });

        authSubscription = subscription;
      } catch (e) {
        console.warn('[AppInitializer] Supabase auth init failed:', e?.message || e);
      }
    })();

    return () => {
      cancelled = true;
      if (authSubscription) {
        try { authSubscription.unsubscribe(); } catch (_) {}
        authSubscription = null;
      }
    };
  }, [dispatch]);

  useEffect(() => {
    loadUserData();
  }, [authUser?.id, reloadUserDataTrigger]);

  return null;
}
