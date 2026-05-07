// Global utility functions for the Zen Scribe editor

import { getEditorText, setEditorText } from './EditorRefHelpers';

// Truncates a string to a maximum number of characters and appends an ellipsis if needed.
export function truncateWithEllipsis(text, maxChars) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return "…";
  return text.slice(0, maxChars - 1) + "…";
}

// Local storage key for persisting tabs state in the browser
const TABS_STORAGE_KEY = 'scribefold:tabsState';

// Generate a unique tab ID based on timestamp and index hint
export function createTabId(indexHint = 1) {
  return `tab-${Date.now()}-${indexHint}`;
}

// Load tabs from localStorage
export function loadTabsFromLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(TABS_STORAGE_KEY);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tabs) || !parsed.tabs.length || !parsed.activeTabId) {
      return null;
    }
    
    // Set loaded: false for all tabs
    const tabs = parsed.tabs.map(tab => ({
      ...tab,
      loaded: false
    }));
    
    return { tabs, activeTabId: parsed.activeTabId };
  } catch (e) {
    console.error('[Functions] Failed to load tabs from localStorage', e);
    return null;
  }
}

// Persist a given tabsSlice state object to localStorage using the shared
// saveTabsStateToStorage helper. Callers are responsible for providing the
// current tabsSlice state (for example from useSelector or store.getState()).
export function saveTabsSliceToStorage(tabsSliceState) {
  if (!tabsSliceState) {
    console.warn('[TabsStorage] No tabsSlice state provided when attempting to save');
    return;
  }
  if (typeof window === 'undefined') return;

  try {
    const serializable = {
      tabs: tabsSliceState.tabs || [],
      activeTabId: tabsSliceState.activeTabId ?? null,
    };
    const payload = JSON.stringify(serializable);
    console.log('[TabsStorage] Saving tabs state:', payload);
    window.localStorage.setItem(TABS_STORAGE_KEY, payload);
  } catch (e) {
    console.error('[TabsStorage] Failed to save tabsSlice state to storage', e);
  }
}

// Local storage key for persisting editor content instances
const EDITOR_CONTENT_INSTANCES_KEY = 'scribefold:editorContentInstances';

// Save editor content instances to localStorage
export function editorContentInstancesToLocalStorage(editorContentInstancesObject) {
  if (!editorContentInstancesObject) {
    console.warn('[EditorContentStorage] No editor content instances provided when attempting to save');
    return;
  }
  if (typeof window === 'undefined') return;

  try {
    const payload = JSON.stringify(editorContentInstancesObject);
    window.localStorage.setItem(EDITOR_CONTENT_INSTANCES_KEY, payload);
  } catch (e) {
    console.error('[EditorContentStorage] Failed to save editor content instances to storage', e);
  }
}

// Load editor content instances from localStorage
export function loadEditorContentInstancesFromLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(EDITOR_CONTENT_INSTANCES_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[EditorContentStorage] Failed to load editor content instances from localStorage', e);
    return null;
  }
}

// Add a new tab and update editor state
export function addNewTab(editorRef, editorContentInstancesRef, editorViewInstancesRef, contentNew, tabIdCurrent, tabIdNew, caller = 'unknown') {
  console.log(`[Functions] Calling addNewTab from ${caller}`, { tabIdCurrent, tabIdNew, contentLength: contentNew?.length });
  
  const view = editorRef?.current;
  if (!view) {
    console.error('[addNewTab] editorRef.current is null');
    return;
  }

  if (!editorContentInstancesRef?.current) {
    console.error('[addNewTab] editorContentInstancesRef.current is null');
    return;
  }

  if (!editorViewInstancesRef?.current) {
    console.error('[addNewTab] editorViewInstancesRef.current is null');
    return;
  }

  // Save current view state
  if (tabIdCurrent) {
    editorViewInstancesRef.current[tabIdCurrent] = view.state;
  }

  // Save current editor content
  if (tabIdCurrent) {
    const currentContent = getEditorText(editorRef);
    editorContentInstancesRef.current[tabIdCurrent] = currentContent;
  }

  // Save to localStorage
  console.log('[Functions] addNewTab: saving editorContentInstances to localStorage', { tabs: Object.keys(editorContentInstancesRef.current), contentPreviews: Object.fromEntries(Object.entries(editorContentInstancesRef.current).map(([tabId, content]) => [tabId, content?.substring(0, 20)])) });
  editorContentInstancesToLocalStorage(editorContentInstancesRef.current);

  // Add new content to editorContentInstancesRef
  editorContentInstancesRef.current[tabIdNew] = contentNew;

  // Update editor content
  console.log('[Functions] addNewTab: calling setEditorText for new tab', { tabIdNew, contentLength: contentNew?.length, contentPreview: contentNew?.substring(0, 20) });
  setEditorText(editorRef, contentNew);

  // Create new entry in editorViewInstancesRef
  editorViewInstancesRef.current[tabIdNew] = view.state;
}

// Replace current tab with new content
// See TabLoading.md for the intended flow.
export function tabReplaceCurrent(
  editorRef,
  editorContentInstancesRef,
  editorViewInstancesRef,
  contentNew,
  tabIdCurrent,
  tabIdNew,
  newTabData,
  tabs,
  caller = 'unknown'
) {
  console.log(`[Functions] Calling tabReplaceCurrent from ${caller}`, {
    tabIdCurrent,
    tabIdNew,
    contentLength: contentNew?.length,
  });

  const view = editorRef?.current;
  if (!view) {
    console.error('[tabReplaceCurrent] editorRef.current is null');
    return { selectedTabId: tabIdNew, newTabs: tabs };
  }

  if (!editorContentInstancesRef?.current) {
    console.error('[tabReplaceCurrent] editorContentInstancesRef.current is null, initializing to {}');
    if (editorContentInstancesRef) {
      editorContentInstancesRef.current = {};
    }
  }

  if (!editorViewInstancesRef?.current) {
    console.error('[tabReplaceCurrent] editorViewInstancesRef.current is null, initializing to {}');
    if (editorViewInstancesRef) {
      editorViewInstancesRef.current = {};
    }
  }

  const safeTabs = Array.isArray(tabs) ? tabs : [];
  if (!Array.isArray(tabs)) {
    console.error('[tabReplaceCurrent] tabs is not an array');
  }

  // delete the both ref[tabIdcurrent] objects
  if (tabIdCurrent) {
    delete editorContentInstancesRef.current[tabIdCurrent];
    delete editorViewInstancesRef.current[tabIdCurrent];
  }

  // set editorContentInstancesRef[tabIdNew] = contentNew
  if (tabIdNew) {
    editorContentInstancesRef.current[tabIdNew] = contentNew ?? '';
  }

  // Save editorContentInstancesRef in localstorage in the way it expects to be read later with the helper function
  console.log('[Functions] tabReplaceCurrent: saving editorContentInstances to localStorage', {
    tabs: Object.keys(editorContentInstancesRef.current),
    contentPreviews: Object.fromEntries(
      Object.entries(editorContentInstancesRef.current).map(([tabId, content]) => [tabId, (content ?? '').substring(0, 20)])
    ),
  });
  editorContentInstancesToLocalStorage(editorContentInstancesRef.current);

  // set editor text to contentNew
  console.log('[Functions] tabReplaceCurrent: calling setEditorText for new tab', {
    tabIdNew,
    contentLength: contentNew?.length,
    contentPreview: (contentNew ?? '').substring(0, 20),
  });
  setEditorText(editorRef, contentNew ?? '');

  // Update view state for the new tab so tab switches can restore it
  if (tabIdNew) {
    editorViewInstancesRef.current[tabIdNew] = view.state;
  }

  // delete tab from tabs array & replace with newTabData
  const newTabs = safeTabs.map((t) => (t.id === tabIdCurrent ? newTabData : t));

  const selectedTabId = tabIdNew;
  return { selectedTabId, newTabs };
}

// Delete a tab and select the next one
export function tabDelete(editorRef, editorContentInstancesRef, editorViewInstancesRef, tabIdToDelete, tabs, caller = 'unknown') {
  console.log(`[Functions] Calling tabDelete from ${caller}`, { tabIdToDelete, tabsCount: tabs?.length });
  
  const view = editorRef?.current;
  if (!view) {
    console.error('[tabDelete] editorRef.current is null');
    return { selectedTabId: null, newTabs: tabs };
  }

  if (!editorContentInstancesRef?.current) {
    console.error('[tabDelete] editorContentInstancesRef.current is null');
    return { selectedTabId: null, newTabs: tabs };
  }

  if (!editorViewInstancesRef?.current) {
    console.error('[tabDelete] editorViewInstancesRef.current is null');
    return { selectedTabId: null, newTabs: tabs };
  }

  // Remove data related to the tab to delete
  delete editorContentInstancesRef.current[tabIdToDelete];
  delete editorViewInstancesRef.current[tabIdToDelete];

  // Save to localStorage
  console.log('[Functions] tabDelete: saving editorContentInstances to localStorage', { tabs: Object.keys(editorContentInstancesRef.current), contentPreviews: Object.fromEntries(Object.entries(editorContentInstancesRef.current).map(([tabId, content]) => [tabId, content?.substring(0, 20)])) });
  editorContentInstancesToLocalStorage(editorContentInstancesRef.current);

  // Create new tabs array without the deleted tab
  const newTabs = tabs.filter(t => t.id !== tabIdToDelete);

  // Select a new tab
  let selectedTabId = null;
  if (newTabs.length > 0) {
    // Try to select the tab before the deleted one, or the first one
    const deletedIndex = tabs.findIndex(t => t.id === tabIdToDelete);
    const newIndex = Math.max(0, deletedIndex - 1);
    selectedTabId = newTabs[newIndex]?.id || newTabs[0]?.id;

    // Set editor view state to the selected tab's view state
    if (selectedTabId && editorViewInstancesRef.current[selectedTabId]) {
      view.setState(editorViewInstancesRef.current[selectedTabId]);
    }
  } else {
    // No more tabs - set editor content to empty string
    console.log('[Functions] tabDelete: calling setEditorText to clear editor (no more tabs)');
    setEditorText(editorRef, '');
  }

  return { selectedTabId, newTabs };
}

// Switch between tabs
export function tabSwitch(editorRef, editorContentInstancesRef, editorViewInstancesRef, tabIdCurrent, tabIdNew, caller = 'unknown') {
  console.log(`[Functions] Calling tabSwitch from ${caller}`, { tabIdCurrent, tabIdNew });
  
  const view = editorRef?.current;
  if (!view) {
    console.error('[tabSwitch] editorRef.current is null');
    return tabIdNew;
  }

  if (!editorContentInstancesRef?.current) {
    console.error('[tabSwitch] editorContentInstancesRef.current is null');
    return tabIdNew;
  }

  if (!editorViewInstancesRef?.current) {
    console.error('[tabSwitch] editorViewInstancesRef.current is null');
    return tabIdNew;
  }

  // Update editorViewInstancesRef for current tab
  if (tabIdCurrent) {
    editorViewInstancesRef.current[tabIdCurrent] = view.state;
  }

  // Update editorContentInstancesRef for current tab
  if (tabIdCurrent) {
    const currentContent = getEditorText(editorRef);
    editorContentInstancesRef.current[tabIdCurrent] = currentContent;
  }

  // Save to localStorage
  console.log('[Functions] tabSwitch: saving editorContentInstances to localStorage', { tabs: Object.keys(editorContentInstancesRef.current), contentPreviews: Object.fromEntries(Object.entries(editorContentInstancesRef.current).map(([tabId, content]) => [tabId, content?.substring(0, 20)])) });
  editorContentInstancesToLocalStorage(editorContentInstancesRef.current);

  // Set editor view state to the new tab's view state if available
  if (tabIdNew && editorViewInstancesRef.current[tabIdNew]) {
    console.log('[Functions] tabSwitch: applying saved view state for new tab', { tabIdNew });
    view.setState(editorViewInstancesRef.current[tabIdNew]);
  } else if (tabIdNew && editorContentInstancesRef.current[tabIdNew] !== undefined) {
    // Fallback for cases like browser refresh where we may only have text snapshots
    const fallbackContent = editorContentInstancesRef.current[tabIdNew] ?? '';
    console.log('[Functions] tabSwitch: no view state for new tab, using editorContentInstancesRef fallback', {
      tabIdNew,
      contentLength: fallbackContent.length,
      contentPreview: fallbackContent.substring(0, 20),
    });
    setEditorText(editorRef, fallbackContent);
  }

  return tabIdNew;
}
