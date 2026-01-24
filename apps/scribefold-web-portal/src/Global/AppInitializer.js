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

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authUser.id)
        .single();

      if (error) {
        console.error('[AppInitializer] Failed to load user data:', error);
        dispatch(setUserDataLoading(false));
        return;
      }

      console.log('[AppInitializer] User data loaded:', data);
      dispatch(setUserData(data));
    } catch (e) {
      console.error('[AppInitializer] Error loading user data:', e);
    } finally {
      dispatch(setUserDataLoading(false));
    }
  }

  useEffect(() => {
    let cancelled = false;
    let authSubscription = null;

    async function initAuth() {
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
    }

    initAuth();

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
