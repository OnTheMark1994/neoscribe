import { isElectron } from './environment';

/**
 * backgroundHelper - Background image loading and management
 * 
 * Purpose: Extracted from App.js to be reusable by AppInitializer and Settings.
 * Handles both Electron (absolute paths) and web (relative paths) environments.
 */

/**
 * Set the background image on the background container element
 * @param {string} imagePath - Image filename or absolute path
 * @param {boolean} persist - Whether to save to localStorage (default: true)
 */
export function setBackground(imagePath, persist = true) {
  const backgroundContainer = document.getElementById('backgroundContainer');
  if (!backgroundContainer) return;

  if (imagePath) {
    // If we are in a normal browser and an old absolute OS path was stored
    // (from a previous Electron custom theme), fall back to the default theme.
    const looksAbsolute = imagePath.includes(':') || imagePath.startsWith('/');
    if (!isElectron() && looksAbsolute) {
      imagePath = 'spacedreams.jpg';
    }

    const isAbsolutePath = isElectron() && looksAbsolute;
    const imageUrl = isAbsolutePath
      ? `file:///${imagePath.replace(/\\/g, '/')}`
      : `images/${imagePath}`;
    backgroundContainer.style.backgroundImage = `url('${imageUrl}')`;
    
    if (persist) {
      try {
        localStorage.setItem('backgroundImage', imagePath);
      } catch (e) {
        // Ignore storage errors
      }
    }
  } else {
    backgroundContainer.style.backgroundImage = 'none';
    if (persist) {
      try {
        localStorage.removeItem('backgroundImage');
      } catch (e) {
        // Ignore storage errors
      }
    }
  }
}

/**
 * Load the saved background from localStorage, or set default
 */
export function loadSavedBackground() {
  try {
    const savedBackground = localStorage.getItem('backgroundImage');
    if (savedBackground) {
      setBackground(savedBackground, false);
    } else {
      // Set spacedreams as default theme
      setBackground('spacedreams.jpg', true);
    }
  } catch (e) {
    setBackground('spacedreams.jpg', true);
  }
}

/**
 * Get the current background image path from localStorage
 * @returns {string} The background image path or default
 */
export function getBackgroundPath() {
  try {
    return localStorage.getItem('backgroundImage') || 'spacedreams.jpg';
  } catch (e) {
    return 'spacedreams.jpg';
  }
}
