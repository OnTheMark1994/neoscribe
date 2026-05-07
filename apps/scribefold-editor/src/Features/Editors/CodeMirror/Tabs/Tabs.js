import { useEffect, useRef, useState } from 'react';
import "./Tabs.css";
import { useDispatch, useSelector } from 'react-redux';
import { setActiveTabId, setTabs } from '../../../../Global/ReduxSlices/TabsSlice';
import { truncateWithEllipsis, loadTabsFromLocalStorage, saveTabsSliceToStorage, tabSwitch, tabDelete, loadEditorContentInstancesFromLocalStorage } from '../../../../Global/Functions';
import ConfirmDialog from '../../../Util/ConfirmDialog';

// Renders the tabs bar
// Only manages tab data (open, close, switch), no editor functionality
export default function Tabs({ editorRef, editorContentInstancesRef, editorViewInstancesRef }) {

  const dispatch = useDispatch();
  const tabs = useSelector(state => state.tabsSlice.tabs);
  const activeTabId = useSelector(state => state.tabsSlice.activeTabId);

  // This is for the close alert for unsaved tabs
  const [pendingCloseTabId, setPendingCloseTabId] = useState(null);

  // Flag to see if we loaded on start
  const loadedTabsFromLocalStorageRef = useRef(false);

  // Load from localstorage on start, then save to localstorage
  useEffect(() => {
    if (!loadedTabsFromLocalStorageRef.current) {
      // First run: load tabs from localStorage
      loadedTabsFromLocalStorageRef.current = true;
      
      const loadedTabs = loadTabsFromLocalStorage();
      const loadedEditorContentInstances = loadEditorContentInstancesFromLocalStorage();
      console.log('[Tabs] initial tab loading from localStorage', {
        loadedTabs,
        editorContentKeys: loadedEditorContentInstances ? Object.keys(loadedEditorContentInstances) : 'none',
        editorContentPreview: loadedEditorContentInstances
          ? Object.fromEntries(
              Object.entries(loadedEditorContentInstances).map(([tabId, content]) => [
                tabId,
                { length: content?.length, preview: content?.substring(0, 50) }
              ])
            )
          : 'none',
      });

      // Populate the per-tab content ref so tabSwitch can restore text after a browser refresh
      if (loadedEditorContentInstances && editorContentInstancesRef?.current) {
        editorContentInstancesRef.current = loadedEditorContentInstances;
      }
      if (loadedTabs) {
        dispatch(setTabs(loadedTabs));
      }
      return;
    }

    // After first run: save tabs to localStorage
    saveTabsSliceToStorage({ tabs: tabs || {}, activeTabId });

  }, [tabs, activeTabId, dispatch]);


  // Handles closing a tab and cleaning up its stored EditorState
  const requestCloseTab = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    // If this tab has unsaved changes, show confirm dialog
    if (tab.modified) {
      setPendingCloseTabId(tabId);
    } else {
      closeTabLocal(tabId)
    }
  };

  function closeTabLocal(tabId){
    // Call helper function to delete tab and update editor state
    const { selectedTabId, newTabs } = tabDelete(editorRef, editorContentInstancesRef, editorViewInstancesRef, tabId, tabs, 'Tabs.js closeTabLocal');
    
    // Update Redux state with new tabs and selected tab
    dispatch(setTabs({ tabs: newTabs, activeTabId: selectedTabId }));

    // Clear pending state if this was a confirmed close
    if (pendingCloseTabId === tabId) {
      setPendingCloseTabId(null);
    }
  }

  // Confirm close - actually close the tab
  const confirmCloseTab = () => {
    if (pendingCloseTabId) {
      closeTabLocal(pendingCloseTabId)
    }
  };

  // Handle tab switch
  const handleTabClick = (tabId) => {
    if (tabId === activeTabId) return;
    
    // Call helper function to switch tabs
    tabSwitch(editorRef, editorContentInstancesRef, editorViewInstancesRef, activeTabId, tabId, 'Tabs.js handleTabClick');
    
    // Update Redux state
    dispatch(setActiveTabId(tabId));
  };

  // If there are zero or one tabs, don't render the tabs bar at all
  if (!tabs || tabs.length <= 1) {
    return null;
  }

  return (
    <>
      <div className="tabsBar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId; // Determine if this tab is the currently active one
          return (
            <div
              key={tab.id}
              className={"tab " + (isActive ? "tabActive" : "")} // Apply active styling if this is the current tab
              title={tab.filepath} // Show the full file path on hover
              onClick={() => {
                handleTabClick(tab.id);
              }}
            >
              <div
                className={"tabCloseButton"} // The small "x" close button in the tab corner
                title={"Close " + tab.title} // Tooltip describing which tab will be closed
                onClick={(event) => {
                  event.stopPropagation(); // Prevent the click from also triggering tab activation
                  requestCloseTab(tab.id); // Run the close logic for this tab
                }}
              >
                x {/* Visual label for the close button */}
              </div>
              {truncateWithEllipsis(tab.title, 22) /* Show the tab title, truncated with ellipsis if too long */}
            </div>
          );
        })}
      </div>
      <ConfirmDialog
        open={!!pendingCloseTabId}
        onClose={() => setPendingCloseTabId(null)}
        onConfirm={confirmCloseTab}
        message="This tab has unsaved changes. Close anyway?"
        confirmText="Close"
        rejectText="Cancel"
        title="Unsaved Changes"
      />
    </>
  );
}
