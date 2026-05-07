import { createSlice } from '@reduxjs/toolkit';

// Default initial state used when there is nothing in localStorage
const defaultState = {
  tabs: [],
  activeTabId: null,
};

const initialState = defaultState;

const tabsSlice = createSlice({
  name: 'tabsSlice',
  initialState,
  reducers: {
    newTab(state, action) {
      const payload = action.payload || {};
      const filepath = payload.filepath || '';
      const explicitTitle = payload.title;
      let title = explicitTitle;

      if (!title) {
        if (filepath) {
          const parts = filepath.split(/[/\\]/);
          title = parts[parts.length - 1] || 'Untitled';
        } else {
          title = 'Untitled';
        }
      }

      const modified = !!payload.modified;
      const loaded = payload.loaded !== false; // Default to true, only false if explicitly set
      const id = payload.id || `tab-${Date.now()}-${state.tabs.length + 1}`;

      state.tabs.push({ id, title, filepath, modified, loaded });
      state.activeTabId = id;
    },
    replaceActiveTab(state, action) {
      const payload = action.payload || {};
      const filepath = payload.filepath || '';
      const explicitTitle = payload.title;
      let title = explicitTitle;

      if (!title) {
        if (filepath) {
          const parts = filepath.split(/[/\\]/);
          title = parts[parts.length - 1] || 'Untitled';
        } else {
          title = 'Untitled';
        }
      }

      const modified = !!payload.modified;
      const loaded = payload.loaded !== false;
      const id = payload.id || `tab-${Date.now()}-${state.tabs.length + 1}`;

      const activeIndex = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
      const nextTab = { id, title, filepath, modified, loaded };

      if (activeIndex === -1) {
        state.tabs.push(nextTab);
      } else {
        state.tabs[activeIndex] = nextTab;
      }

      state.activeTabId = id;
    },
    // Updates the currently active tab's filepath/title/modified fields after file operations or edits
    updateActiveTabFromFile(state, action) {
      const payload = action.payload || {}; // Normalized payload so we can safely read optional fields
      const activeId = state.activeTabId; // Id of the tab we consider "active" right now
      if (!activeId) return; // If there is no active tab, nothing to update

      const tab = state.tabs.find(t => t.id === activeId); // Look up the active tab object in the tabs array
      if (!tab) return; // If the active id does not match any tab, abort

      const filepath = payload.filepath ?? tab.filepath ?? ''; // Prefer incoming filepath, fall back to existing tab filepath or empty string
      const explicitTitle = payload.title; // Optional explicit title provided by caller
      let title = explicitTitle; // Start with explicit title, may be filled from filepath below

      if (!title) { // If no explicit title was given, derive one automatically
        if (filepath) { // When we have a filepath, use the last path segment as the title
          const parts = filepath.split(/[/\\]/);
          title = parts[parts.length - 1] || 'Untitled';
        } else { // If there is no filepath yet, default to a generic "Untitled" label
          title = 'Untitled';
        }
      }

      tab.filepath = filepath; // Persist the resolved filepath on the active tab
      tab.title = title; // Persist the resolved title on the active tab
      tab.modified = !!payload.modified; // Update the modified flag for this tab (default false if omitted)
      tab.loaded = true; // Mark as loaded when file is opened
    },
    closeTab(state, action) {
      const tabId = action.payload;
      // Find the index of the tab based on the tab id
      const idx = state.tabs.findIndex((t) => t.id === tabId);
      // If a tab with a matching id does not exist in the array of tabs return
      if (idx === -1) return;

      // Remove it from the tabs array
      state.tabs.splice(idx, 1);

      // If there are now no open tabs set active tab id to null
      if (state.tabs.length === 0) {
        state.activeTabId = null;
        return;
      }

      // Increment to the next tab if closing current tab
      if (state.activeTabId === tabId) {
        const newIndex = Math.max(0, idx - 1);
        state.activeTabId = state.tabs[newIndex].id;
      }
    },
    setActiveTabId(state, action) {
      state.activeTabId = action.payload;
    },
    setTabs(state, action) {
      const payload = action.payload || {};
      state.tabs = payload.tabs || [];
      state.activeTabId = payload.activeTabId || null;
    },
    markTabLoaded(state, action) {
      const tabId = action.payload;
      const tab = state.tabs.find(t => t.id === tabId);
      console.log("marked tab as loaded", tabId, tab)
      if (tab) {
        tab.loaded = true;
      }
    }
  },
});

export const { newTab, replaceActiveTab, closeTab, setActiveTabId, setTabs, updateActiveTabFromFile, markTabLoaded } = tabsSlice.actions;

export default tabsSlice.reducer;
