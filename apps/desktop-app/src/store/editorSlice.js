import { createSlice } from '@reduxjs/toolkit';

/**
 * editorSlice - Redux slice for editor global state
 * 
 * PURPOSE: Manages state that multiple components need to read:
 *   - currentFilePath: For window title (App), menu state (WebMenuBar), display (Editor)
 *   - isModified: For window title "*" (App), save warnings (App), menu state (WebMenuBar)
 *   - viewMode: For settings persistence (future)
 *   - isArrayView: Legacy debug toggle
 * 
 * WHY REDUX: These values are read by multiple components across the tree
 * WHY NOT REDUX: Document content (too large, performance issue to dispatch on every keystroke)
 * 
 * PERSISTENCE: 
 *   - currentFilePath: Also saved to localStorage 'lastOpenedFile' by Editor.js (manual sync)
 *   - viewMode: Also saved to localStorage by Editor.js (manual sync)
 *   - Pattern: Editor dispatches to Redux AND manually saves to localStorage
 *   - On startup: Editor reads localStorage, dispatches to Redux
 * 
 * WHO UPDATES:
 *   - Editor.js: All file operations (open, save, new) update currentFilePath and isModified
 *   - Editor.js: View mode switches update viewMode
 *   - Components NEVER update via callbacks - they import useDispatch and dispatch directly
 */

const initialState = {
  // WHAT: Absolute path to currently open file (e.g., "C:\\Users\\...\\file.txt") or null if no file
  // UPDATED BY: fileOps + WebMenuBar when file opened/saved/closed
  // READ BY: App (for title), WebMenuBar (for menu state), Editor (for display)
  // PERSISTENCE: Also in localStorage 'lastOpenedFile' (synced manually)
  currentFilePath: null,
  
  // WHAT: Document content (text)
  // UPDATED BY: ONLY on file operations (open, new), NOT on every keystroke
  // READ BY: Editor/EditorNew for initial render
  // WHY NOT UPDATE ON KEYSTROKE: Performance - local state handles typing, sync to Redux only on file ops
  content: '',
  
  // WHAT: Boolean indicating if document has unsaved changes
  // UPDATED BY: Editor/EditorNew on any content change or save
  // READ BY: App (for title "*" and beforeunload warning), WebMenuBar (for menu state)
  isModified: false,
  
  // WHAT: Current editor view mode
  // VALUES: 'array' (fold view), 'monaco' (code editor), 'textarea' (plain text)
  // UPDATED BY: Editor when user switches views
  // READ BY: Editor (for rendering), potentially Settings in future
  viewMode: 'array',
  
  // WHAT: Which editor component to render
  // VALUES: 'array' (EditorArray - line-based fold editor), 'monaco' (SimpleMonaco)
  // UPDATED BY: Settings or WebMenuBar toggle
  // READ BY: App.js to conditionally render editor component
  // DEFAULT: 'monaco' so Monaco editor is the initial view
  viewType: 'monaco',
  
  // WHAT: Legacy debug toggle for array view styling
  // TODO: Evaluate if still needed, possibly remove
  isArrayView: true,

  // WHAT: Triggers for editor actions that can't live in Redux directly
  // HOW: Components increment these counters; editors watch with useEffect.
  foldAllTrigger: 0,
  unfoldAllTrigger: 0,
  saveTrigger: 0,
  saveAsTrigger: 0, // Always opens save dialog, ignores existing filePath
};

const editorSlice = createSlice({
  name: 'editor',
  initialState,
  reducers: {
    // WHAT: Updates the file path of currently open file
    // WHEN: Called by Editor after file opened, saved-as, or closed (null)
    // SIDE EFFECTS: None (pure Redux state update)
    // NOTE: Editor also manually updates localStorage 'lastOpenedFile' after dispatching this
    setCurrentFilePath(state, action) {
      state.currentFilePath = action.payload || null;
    },
    
    // WHAT: Updates the modified flag indicating unsaved changes
    // WHEN: Called by Editor on content changes (true) or after save (false)
    // SIDE EFFECTS: Sets window.isModified for backwards compatibility with Electron beforeunload
    // TODO: Remove window.isModified, use Redux selector everywhere
    setIsModified(state, action) {
      state.isModified = !!action.payload;
      // ❌ BAD: Global variable pollution, should use Redux selector instead
      // Kept for backwards compatibility with existing Electron code
      if (typeof window !== 'undefined') {
        window.isModified = state.isModified;
      }
    },
    // WHAT: Updates the view mode
    // WHEN: Called by Editor when user switches between array/monaco/textarea views
    // VALIDATION: Only accepts valid mode strings, ignores invalid values
    setViewMode(state, action) {
      const mode = action.payload;
      if (mode === 'array' || mode === 'monaco' || mode === 'textarea') {
        state.viewMode = mode;
      }
    },
    
    // WHAT: Toggles array view styling (legacy debug feature)
    // TODO: Evaluate if still needed
    setIsArrayView(state, action) {
      state.isArrayView = !!action.payload;
    },
    
    // WHAT: Sets which editor component to render (array or monaco)
    // WHEN: Called when user toggles between EditorArray and SimpleMonaco
    setViewType(state, action) {
      const type = action.payload;
      if (type === 'array' || type === 'monaco') {
        state.viewType = type;
      }
    },
    
    // WHAT: Resets editor to clean state (no file open, no changes)
    // WHEN: Used for "New" operation
    // NOTE: Preserves viewMode as user preference
    resetEditor(state) {
      state.currentFilePath = null;
      state.content = '';
      state.isModified = false;
      // Keep viewMode and isArrayView as user preference
    },

    // WHAT: Sets document content explicitly (used for view-mode sync, not keystrokes)
    // WHEN: Called when switching from array view to Monaco so Monaco can read latest text
    setContent(state, action) {
      state.content = action.payload || '';
    },
    
    // WHAT: Bump fold/unfold/save triggers so editors can react via useEffect
    bumpFoldAllTrigger(state) {
      state.foldAllTrigger += 1;
    },
    bumpUnfoldAllTrigger(state) {
      state.unfoldAllTrigger += 1;
    },
    bumpSaveTrigger(state) {
      state.saveTrigger += 1;
    },
    bumpSaveAsTrigger(state) {
      state.saveAsTrigger += 1;
    },
    
    // WHAT: Combined action for file open/new operations
    // WHY: Atomically updates filePath, content, and isModified in one dispatch
    // WHEN: Called by WebMenuBar after fileOps.openFile() succeeds
    fileOpened(state, action) {
      const { filePath, content } = action.payload || {};
      state.currentFilePath = filePath || null;
      state.content = content || '';
      state.isModified = false;
    },
  },
});

export const {
  setCurrentFilePath,
  setIsModified,
  setViewMode,
  setViewType,
  setIsArrayView,
  resetEditor,
  bumpFoldAllTrigger,
  bumpUnfoldAllTrigger,
  bumpSaveTrigger,
  bumpSaveAsTrigger,
  setContent,
  fileOpened,
} = editorSlice.actions;

// Selectors - Functions to read specific slices of state
// WHY: Encapsulates state shape, if we reorganize Redux structure, only update selectors
// USAGE: const filePath = useSelector(selectCurrentFilePath);

// Returns currently open file path (absolute path string or null)
export const selectCurrentFilePath = (state) => state.editor.currentFilePath;

// Returns boolean indicating if document has unsaved changes
export const selectIsModified = (state) => state.editor.isModified;

// Returns current view mode string: 'array', 'monaco', or 'textarea'
export const selectViewMode = (state) => state.editor.viewMode;

// Returns boolean for array view styling (legacy)
export const selectIsArrayView = (state) => state.editor.isArrayView;

// Returns which editor component to render: 'array' or 'monaco'
export const selectViewType = (state) => state.editor.viewType;

// Returns current document content
export const selectContent = (state) => state.editor.content;

// Returns action triggers
export const selectFoldAllTrigger = (state) => state.editor.foldAllTrigger;
export const selectUnfoldAllTrigger = (state) => state.editor.unfoldAllTrigger;
export const selectSaveTrigger = (state) => state.editor.saveTrigger;
export const selectSaveAsTrigger = (state) => state.editor.saveAsTrigger;

export default editorSlice.reducer;
