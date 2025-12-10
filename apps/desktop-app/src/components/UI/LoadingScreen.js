import React from 'react';
import { useSelector } from 'react-redux';
import { selectIsLoadingVisible } from '../../store/uiSlice';

/**
 * LoadingScreen - Simple loading overlay component
 * 
 * Purpose: Display loading overlay during app initialization.
 * Visibility is controlled via Redux ui.isLoadingVisible state.
 * 
 * Design: Pure presentational component with no business logic.
 */
function LoadingScreen() {
  const isVisible = useSelector(selectIsLoadingVisible);

  if (!isVisible) return null;

  return (
    <div className="loading-screen" id="loadingScreen">
      <div className="loading-text">Loading...</div>
    </div>
  );
}

export default LoadingScreen;
