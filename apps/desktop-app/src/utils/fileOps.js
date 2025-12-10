import { isWeb } from './environment';
import { uploadTextFile } from './webFileOps';

/**
 * fileOps.js - Centralized file operations
 * 
 * WHY: File open/save/new operations should not live inside Editor component.
 * Design Principle 11: Parents/menus should not call child component methods.
 * 
 * This module provides:
 * - openFile: Shows dialog and returns { success, filePath, content }
 * - saveFile: Saves to existing path or falls back to saveAs
 * - saveFileAs: Shows save dialog and saves
 * - newFile: Creates new empty file (just returns empty state)
 * 
 * Components (Editor, EditorNew) just render content from Redux.
 * Menus call these utilities and dispatch results to Redux.
 */

/**
 * Opens a file using native dialog (Electron) or browser upload (web)
 * @returns {Promise<{success: boolean, filePath?: string, content?: string, error?: string}>}
 */
export async function openFile() {
  if (isWeb()) {
    // Web mode: Browser file upload
    const result = await uploadTextFile();
    return result; // Already in correct format: { success, fileName, content }
  } else {
    // Electron mode: Native file dialog
    if (!window.electronAPI?.openEncryptedFile) {
      return { success: false, error: 'Electron API not available' };
    }
    
    const result = await window.electronAPI.openEncryptedFile();
    return result; // { success, filePath, content } or { success: false, error }
  }
}

/**
 * Opens a specific file by path (Electron only, used for "last opened file")
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<{success: boolean, filePath?: string, content?: string, error?: string}>}
 */
export async function openFileByPath(filePath) {
  if (isWeb()) {
    return { success: false, error: 'Cannot open by path in web mode' };
  }
  
  if (!window.electronAPI?.openEncryptedFileWithPath) {
    return { success: false, error: 'Electron API not available' };
  }
  
  const result = await window.electronAPI.openEncryptedFileWithPath(filePath);
  return result;
}

/**
 * Saves file to existing path, or calls saveAs if no path
 * @param {string|null} filePath - Current file path (null triggers saveAs)
 * @param {string} content - Content to save
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
export async function saveFile(filePath, content) {
  if (isWeb()) {
    // Web doesn't have "save" - it's always a download
    return { success: false, error: 'Use download/saveAs in web mode' };
  }
  
  if (!window.electronAPI?.saveFile) {
    return { success: false, error: 'Electron API not available' };
  }
  
  if (!filePath) {
    // No existing path, use saveAs
    return saveFileAs(content);
  }
  
  try {
    const result = await window.electronAPI.saveFile(filePath, content);
    return result; // { success, error? }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Shows save dialog and saves to chosen location
 * @param {string} content - Content to save
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
export async function saveFileAs(content) {
  if (isWeb()) {
    return { success: false, error: 'Use download modal in web mode' };
  }
  
  if (!window.electronAPI?.saveFileAs) {
    return { success: false, error: 'Electron API not available' };
  }
  
  try {
    const result = await window.electronAPI.saveFileAs(content);
    return result; // { success, filePath?, error? }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Creates a new file (just returns empty state, doesn't actually create anything)
 * Caller should confirm with user if there are unsaved changes
 * @returns {{success: true, filePath: null, content: ''}}
 */
export function newFile() {
  return {
    success: true,
    filePath: null,
    content: ''
  };
}
