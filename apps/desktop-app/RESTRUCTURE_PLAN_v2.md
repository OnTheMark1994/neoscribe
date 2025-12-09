### Anti-pattern: boomerang prop drilling of local state

Avoid sending transitory UI state up from a component only to pass it straight back down again. For example, we briefly had this pattern:

- WebMenuBar raised fullscreen toggle up to App via an onToggleFullscreen prop.
- App owned isFullscreen state and DOM/Electron listeners.
- App then passed isFullscreen back down into WebMenuBar as a prop.

This created **boomerang state**: the only real consumer of isFullscreen was the menu bar itself (to hide/show and change the F11 label), yet it was managed in App and drilled both ways for no benefit.

Fix:

- WebMenuBar now owns its own isFullscreen state and the associated DOM/Electron calls.
- App no longer tracks fullscreen at all.

Rule of thumb:

- If state is only used by a single component (and perhaps its own immediate children), keep it **local** to that component.
- Use Redux only when multiple unrelated parts of the tree need the same state, or when the state is a real piece of app data/settings, not a transient visual flag.



# ScribeFold AI Desktop App - Restructuring Plan v2

## Executive Summary

This document is the **single source of truth** for restructuring the ScribeFold AI desktop app. The goals are:

1. **Eliminate prop drilling** - Components read directly from Redux
2. **Centralize state** - All shared state lives in Redux slices
3. **Improve organization** - Clear file structure without over-engineering
4. **Maintain functionality** - Zero feature loss, only reorganization
5. **Follow standards** - React/Redux best practices
6. **Enable scalability** - Easy to add features in the future

### Design Principles

| Principle | Application |
|-----------|-------------|
| **Minimal Complexity** | Don't create wrapper components for simple divs; keep flat folder structure |
| **Reusability** | Extract only when code is duplicated or component is 50+ lines |
| **Readability** | Clear naming, single responsibility, logical grouping |
| **Efficiency** | Keep frequently-changing data (content, find state) in local state, not Redux |
| **Standards** | Redux Toolkit patterns, functional components, hooks |
| **Scalability** | Redux makes adding features easy; clear boundaries between concerns |

---

## 1. Project Structure

### 1.1 Final Directory Layout

```
src/
├── App.js                      # Root component - renders layout and global components
├── App.css                     # Global styles
├── index.js                    # Entry point
├── index.css                   # Base styles
│
├── store/                      # Redux state management
│   ├── store.js                # Store configuration
│   ├── userSlice.js            # User identity and token state
│   ├── editorSlice.js          # Editor state (NEW)
│   ├── settingsSlice.js        # All persistent settings (NEW)
│   ├── uiSlice.js              # Transient UI state (modals, loading)
│   └── aiChangesSlice.js       # AI diff/change tracking (EXISTING - keep as-is)
│
├── components/                 # All React components (flat structure)
│   ├── AppInitializer.js       # NEW: Initialization logic
│   ├── LoadingScreen.js        # NEW: Loading overlay
│   ├── Menus.js                # NEW: All modals container
│   ├── Editor.js               # REFACTOR: Main editor orchestrator
│   ├── FoldEditorView.js       # KEEP: Array/fold view
│   ├── MonacoEditorView.js     # REFACTOR: Monaco editor view
│   ├── TextareaEditorView.js   # KEEP: Plain textarea view
│   ├── EditorLine.js           # KEEP: Line component for array view
│   ├── AISidebar.js            # REFACTOR: AI chat sidebar
│   ├── DiffNavigation.js       # KEEP: Already uses Redux correctly
│   ├── DiffActionButtons.js    # KEEP: Accept/reject buttons
│   ├── Settings.js             # REFACTOR: Settings UI
│   ├── AccountAuthSection.js   # KEEP: Account auth section
│   ├── TokenInfoModal.js       # KEEP: Token info modal
│   ├── TokenUsageLog.js        # KEEP: Token usage log
│   ├── RefreshButton.js        # KEEP: Refresh button
│   ├── ConfirmCloseModal.js    # KEEP: Unsaved changes dialog
│   ├── WebMenuBar.js           # KEEP: Web-only menu bar
│   └── Window.js               # KEEP: Generic modal component
│
├── utils/                      # Utility functions
│   ├── aiService.js            # KEEP: AI API calls
│   ├── editorEngine.js         # KEEP: Line state management
│   ├── environment.js          # KEEP: Environment detection
│   ├── webFileOps.js           # KEEP: Web file operations
│   ├── constants.js            # KEEP: Constants
│   └── backgroundHelper.js     # NEW: Background image helper
│
└── hooks/                      # Custom hooks (optional, add as needed)
    └── useElectronEvents.js    # OPTIONAL: Electron event listeners

### 1.2 Design Rationale

**Why flat `components/` folder?**
- **Readability**: All components visible at one level, easy to find
- **Minimal Complexity**: No navigation through nested folders
- **Standards**: Many React projects use flat structure successfully
- **Scalability**: Can add subfolders later if component count exceeds ~30

**Why no `EditorViewRouter.js`, `MainLayout.js`, `StatusBar.js`?**
- These would be tiny wrapper components (5-10 lines each)
- **Minimal Complexity**: Inline simple JSX rather than creating files
- The parent component (`Editor.js`, `App.js`) already handles routing/layout cleanly

**Why keep `FoldEditorView.js` name (not rename to `ArrayEditorView.js`)?**
- **Minimal Complexity**: Avoid unnecessary renames that create churn
- Existing name is functional and descriptive

---

## 2. Redux State Architecture

### 2.1 Store Structure

```javascript
// store/store.js
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import editorReducer from './editorSlice';
import settingsReducer from './settingsSlice';
import uiReducer from './uiSlice';
import aiChangesReducer from './aiChangesSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    editor: editorReducer,
    settings: settingsReducer,
    ui: uiReducer,
    aiChanges: aiChangesReducer,  // EXISTING - keep as-is
  },
});
```

### 2.2 Slice Definitions

#### userSlice.js (EXTEND existing)

**Purpose**: User identity, authentication, and token balance

```javascript
{
  anonId: string | null,       // Anonymous user ID
  authId: string | null,       // Authenticated user ID (Supabase)
  deviceId: string | null,     // NEW: Device ID for token grants
  userData: object | null,     // Full user data from API
  availableTokens: number | null,  // NEW: Calculated from userData
  loading: boolean,
  error: string | null
}
```

**Actions**:
- `setAnonId(id)` - Set anonymous ID
- `setAuthId(id)` - Set authenticated ID
- `setDeviceId(id)` - NEW: Set device ID
- `setUserData(data)` - Set user data AND calculate availableTokens
- `setAvailableTokens(count)` - Direct set for refresh operations
- `clearUser()` - Clear all user data

**Design Rationale**:
- **Single Source of Truth**: `availableTokens` is calculated in `setUserData` reducer, so it's always in sync with userData
- **Efficiency**: Calculated once on data change, not on every render
- **Reusability**: Any component can read `user.availableTokens` directly

#### editorSlice.js (NEW)

**Purpose**: Editor-wide state that was previously scattered across App.js and Editor.js

```javascript
{
  currentFilePath: string | null,  // Path of currently open file
  isModified: boolean,             // Document has unsaved changes
  viewMode: 'array' | 'monaco' | 'textarea',  // Current editor view
  isArrayView: boolean             // Array view style toggle
}
```

**Actions**:
- `setCurrentFilePath(path)`
- `setIsModified(boolean)`
- `setViewMode(mode)`
- `setIsArrayView(boolean)`
- `resetEditor()` - Reset to initial state (for new file)

**Design Rationale**:
- **Organization**: Groups related editor state in one place
- **Eliminates Prop Drilling**: `Editor.js` no longer needs `currentFilePath` prop from `App.js`
- **Standards**: Follows Redux pattern for shared UI state

**Why `content` is NOT in Redux**:
- Document content changes on every keystroke
- Redux dispatch on every keystroke = performance problem
- Content lives in `editorEngine.js` (lines array) and local component state
- **Efficiency**: Local state updates are faster than Redux dispatches

**Why `findState` is NOT in Redux**:
- Find/replace is transient UI state local to Editor.js
- No other component needs to know about find matches
- **Minimal Complexity**: Keep local what can be local

#### settingsSlice.js (NEW)

**Purpose**: All persistent user settings, synced with localStorage

```javascript
{
  isAIEnabled: boolean,            // AI sidebar enabled
  developerMode: boolean,          // Developer mode enabled
  backgroundImage: string,         // Background theme path
  showPreviewBar: boolean,         // Monaco minimap visible
  showMonacoLineNumbers: boolean,  // Monaco line numbers visible
  aiService: string,               // Selected AI service
  apiKeys: object                  // API keys by service
}
```

**Actions**:
- `setIsAIEnabled(boolean)`
- `setDeveloperMode(boolean)`
- `setBackgroundImage(path)`
- `setShowPreviewBar(boolean)`
- `setShowMonacoLineNumbers(boolean)`
- `setAiService(service)`
- `setApiKeys(keys)`
- `loadAllSettings()` - Load all from localStorage (called on init)
- `updateSetting(key, value)` - Generic setter that also persists to localStorage

**Design Rationale**:
- **Single Source of Truth**: All settings in one place
- **Reusability**: Any component can read settings without props
- **Standards**: Thunk or middleware can handle localStorage sync
- **Scalability**: Easy to add new settings

**localStorage Sync Pattern**:
```javascript
// In settingsSlice.js
updateSetting: (state, action) => {
  const { key, value } = action.payload;
  state[key] = value;
  // Also persist to localStorage
  localStorage.setItem(key, JSON.stringify(value));
}

// Or use a listener middleware for all settings changes
```

#### uiSlice.js (EXTEND existing)

**Purpose**: Transient UI state for modals, loading, fullscreen

```javascript
{
  isSettingsOpen: boolean,         // EXISTING
  settingsTab: string | null,      // EXISTING
  showUnsavedDialog: boolean,      // NEW: Unsaved changes modal
  showDownloadModal: boolean,      // NEW: Web download modal
  isLoadingVisible: boolean        // NEW: Loading screen visible
}
```

**Actions**:
- `openSettings({ tab })` - EXISTING
- `closeSettings()` - EXISTING
- `setSettingsTab(tab)` - EXISTING
- `openUnsavedDialog()` - NEW
- `closeUnsavedDialog()` - NEW
- `openDownloadModal()` - NEW
- `closeDownloadModal()` - NEW
- `setLoadingVisible(boolean)` - NEW

**Design Rationale**:
- **Organization**: All modal visibility in one slice
- **Eliminates Prop Drilling**: `Menus.js` reads directly from Redux
- **Minimal Complexity**: Simple boolean flags, no complex state

#### aiChangesSlice.js (KEEP existing)

**Purpose**: AI diff/change tracking - already well-structured

```javascript
{
  allChangeIds: array,
  currentChangeIdIndex: number,
  processedChangesByLineID: object,
  autoAdvanceOnResolve: boolean
}
```

**Design Rationale**:
- **Already Works**: `DiffNavigation.js` already uses this correctly
- **Don't Fix What Isn't Broken**: No changes needed
- **Standards**: Already follows Redux Toolkit patterns

---

## 3. Component Specifications

### 3.1 App.js

**Purpose**: Root component, minimal orchestration

**Current Size**: ~657 lines → **Target Size**: ~80 lines

**Redux Access**:
- Reads: `settings.isAIEnabled`, `ui.isSettingsOpen` (for conditional rendering)
- Writes: None directly (child components handle)

**Responsibilities**:
- Render `<AppInitializer />` (handles all init logic)
- Render `<LoadingScreen />`
- Render `<WebMenuBar />` (web only)
- Render background container div
- Render page container with `<Editor />`
- Render `<AISidebar />` (if AI enabled)
- Render `<DiffNavigation />`
- Render status bar div
- Render `<Menus />` (all modals)

**JSX Structure**:
```jsx
function App() {
  const isAIEnabled = useSelector(state => state.settings.isAIEnabled);
  const isWeb = environment.isWeb();

  return (
    <div className={`App ${isWeb ? 'has-web-menu' : ''} ${isAIEnabled ? 'ai-sidebar-visible' : ''}`}>
      <AppInitializer />
      <LoadingScreen />
      {isWeb && <WebMenuBar />}
      <div id="backgroundContainer" className="background-container" />
      <div className="page-container">
        <div className="page">
          <Editor />
        </div>
      </div>
      {isAIEnabled && <AISidebar />}
      <DiffNavigation />
      <div id="status" className="status" />
      <Menus />
    </div>
  );
}
```

**Design Rationale**:
- **Readability**: Clear what the app renders at a glance
- **Minimal Complexity**: No business logic, just composition
- **Standards**: Container/presenter pattern

---

### 3.2 AppInitializer.js (NEW)

**Purpose**: Handle ALL initialization logic in one place

**Display**: None (returns `null`)

**Redux Access**:
- Writes: `user.*`, `settings.*`, `ui.isLoadingVisible`, `editor.*`

**Responsibilities**:
1. Load anonId (Electron: `getAnonId()`, Web: `getWebAnonId()`)
2. Load deviceId (Electron only)
3. Load authId from localStorage
4. Dispatch IDs to Redux
5. Fetch user account data from API
6. Calculate and set availableTokens
7. Load all settings from localStorage → dispatch to settingsSlice
8. Load background image
9. Set up Electron event listeners
10. Hide loading screen when done

**Code Structure**:
```javascript
function AppInitializer() {
  const dispatch = useDispatch();

  useEffect(() => {
    async function initialize() {
      // 1. Load IDs
      // 2. Dispatch to Redux
      // 3. Fetch user data
      // 4. Load settings
      // 5. Setup Electron listeners
      // 6. Hide loading
      dispatch(setLoadingVisible(false));
    }
    initialize();
  }, [dispatch]);

  // Setup Electron event listeners
  useEffect(() => {
    if (!isElectron()) return;
    
    window.electronAPI.onSettingsUpdated((event, settings) => {
      // Dispatch settings changes to Redux
    });
    
    // ... other listeners
  }, [dispatch]);

  return null; // No UI
}
```

**Design Rationale**:
- **Organization**: All init logic in one file, not scattered across App.js
- **Readability**: Easy to understand app startup sequence
- **Standards**: Separation of concerns - init is separate from rendering
- **Scalability**: Easy to add new init steps

---

### 3.3 LoadingScreen.js (NEW)

**Purpose**: Simple loading overlay

**Redux Access**:
- Reads: `ui.isLoadingVisible`

**Code**:
```javascript
function LoadingScreen() {
  const isVisible = useSelector(state => state.ui.isLoadingVisible);
  
  if (!isVisible) return null;
  
  return (
    <div className="loading-screen">
      <div className="loading-text">Loading...</div>
    </div>
  );
}
```

**Design Rationale**:
- **Minimal Complexity**: Simple component, ~15 lines
- **Reusability**: Could be used for other loading states in future
- **Standards**: Conditional rendering based on Redux state

---

### 3.4 Menus.js (NEW)

**Purpose**: Centralized container for ALL modals

**Redux Access**:
- Reads: `ui.showUnsavedDialog`, `ui.showDownloadModal`, `ui.isSettingsOpen`, `ui.settingsTab`
- Writes: `ui.*` (to close modals)

**Responsibilities**:
- Render `<ConfirmCloseModal />` when `showUnsavedDialog` is true
- Render download modal when `showDownloadModal` is true
- Render `<Settings />` in `<Window />` when `isSettingsOpen` is true

**Code Structure**:
```javascript
function Menus() {
  const dispatch = useDispatch();
  const { showUnsavedDialog, showDownloadModal, isSettingsOpen, settingsTab } = 
    useSelector(state => state.ui);

  const handleUnsavedSave = () => {
    dispatch(closeUnsavedDialog());
    window.electronAPI?.unsavedChangesResponse('save');
  };

  const handleUnsavedDiscard = () => {
    dispatch(closeUnsavedDialog());
    window.electronAPI?.unsavedChangesResponse('discard');
  };

  const handleUnsavedCancel = () => {
    dispatch(closeUnsavedDialog());
    window.electronAPI?.unsavedChangesResponse('cancel');
  };

  return (
    <>
      {showUnsavedDialog && (
        <ConfirmCloseModal
          onSave={handleUnsavedSave}
          onDiscard={handleUnsavedDiscard}
          onCancel={handleUnsavedCancel}
        />
      )}
      
      {showDownloadModal && (
        <Window title="Download" onClose={() => dispatch(closeDownloadModal())}>
          <DownloadModalContent />
        </Window>
      )}
      
      {isSettingsOpen && (
        <Window title="Settings" onClose={() => dispatch(closeSettings())}>
          <Settings initialTab={settingsTab} />
        </Window>
      )}
    </>
  );
}
```

**Design Rationale**:
- **Organization**: All modals in one place, not scattered in App.js
- **Eliminates Prop Drilling**: Modal visibility from Redux, not props
- **Readability**: Clear which modals exist and when they show
- **Reusability**: `Window` component reused for multiple modals

---

### 3.5 Editor.js (REFACTOR)

**Purpose**: Main editor orchestrator

**Current Size**: ~1280 lines → **Target Size**: ~800-900 lines (after moving init logic out)

**Redux Access**:
- Reads: `editor.viewMode`, `editor.isArrayView`, `editor.currentFilePath`, `settings.isAIEnabled`, `aiChanges.*`
- Writes: `editor.isModified`, `editor.viewMode`, `editor.isArrayView`

**Responsibilities**:
- Handle file operations (new, open, save, saveAs)
- Handle keyboard shortcuts (Ctrl+S, Ctrl+F)
- Manage view mode switching
- Manage find/replace (local state)
- Coordinate with editorEngine
- Render appropriate view (FoldEditorView, MonacoEditorView, TextareaEditorView)

**What STAYS in Editor.js**:
- View mode switching logic
- File operations (handleNew, handleOpen, handleSave, handleSaveAs)
- Find/replace state and logic (local, not Redux)
- Keyboard shortcut handling
- Render logic for views

**What MOVES OUT**:
- Initialization of lastOpenedFile → AppInitializer
- Loading screen hiding → AppInitializer

**Design Rationale**:
- **Organization**: Editor is still the hub for editing concerns
- **Efficiency**: Find state stays local (transient, high-frequency updates)
- **Standards**: Single responsibility - editing, not init

---

### 3.6 FoldEditorView.js, MonacoEditorView.js, TextareaEditorView.js

**Purpose**: Specific editor view implementations

**Changes**:
- **MonacoEditorView**: Read `settings.showPreviewBar`, `settings.showMonacoLineNumbers` from Redux instead of localStorage
- **FoldEditorView, TextareaEditorView**: Minimal changes, read `settings.isAIEnabled` from Redux if needed

**Design Rationale**:
- **Reusability**: Views are pure rendering, no business logic
- **Standards**: Props for callbacks, Redux for shared state

---

### 3.7 AISidebar.js (REFACTOR)

**Purpose**: AI chat sidebar with token management

**Current Props**: `anonId`, `authId`, `developerMode`, `initialAvailableTokens`, `onAIResponse`

**Target Props**: `onAIResponse` only (or none if we dispatch directly)

**Redux Access**:
- Reads: `user.anonId`, `user.authId`, `user.availableTokens`, `settings.developerMode`, `settings.isAIEnabled`
- Writes: `aiChanges.*` (via dispatch)

**Changes**:
1. Remove props: `anonId`, `authId`, `developerMode`, `initialAvailableTokens`
2. Read these from Redux instead
3. Keep `onAIResponse` for now (can eliminate later by dispatching directly)

**Design Rationale**:
- **Eliminates Prop Drilling**: IDs and settings from Redux
- **Single Source of Truth**: `availableTokens` comes from `userSlice`
- **Scalability**: Easy to add new AI features

---

### 3.8 Settings.js (REFACTOR)

**Purpose**: Settings UI with tabs

**Current Props**: `anonId`, `authId`, `deviceId`, `userAccount`, `onClose`, `onThemeChanged`, `initialTab`

**Target Props**: `initialTab`, `onClose` only

**Redux Access**:
- Reads: `user.*`, `settings.*`
- Writes: `settings.*`

**Changes**:
1. Remove props for user data - read from Redux
2. When setting changes: dispatch to settingsSlice (which also saves to localStorage)
3. Keep `onClose` prop (called by parent Menus.js)
4. Remove `onThemeChanged` - background updates via settingsSlice → AppInitializer watches

**Design Rationale**:
- **Single Source of Truth**: Settings live in Redux
- **Standards**: Component dispatches actions, doesn't manage storage directly
- **Reusability**: Settings component works the same in Electron and web

---

### 3.9 DiffNavigation.js (KEEP AS-IS)

**Purpose**: Navigate AI changes

**Already correct**: Uses `useSelector` and `useDispatch` properly

**No changes needed** - exemplar of correct Redux usage

---

## 4. Utility Functions

### 4.1 backgroundHelper.js (NEW)

**Purpose**: Extract background image logic from App.js

**Functions**:
```javascript
/**
 * Set the background image on the background container
 * @param {string} imagePath - Image filename or absolute path
 */
export function setBackground(imagePath) {
  const backgroundContainer = document.getElementById('backgroundContainer');
  if (!backgroundContainer) return;

  if (imagePath) {
    const looksAbsolute = imagePath.includes(':') || imagePath.startsWith('/');
    if (!isElectron() && looksAbsolute) {
      imagePath = 'spacedreams.jpg';
    }

    const isAbsolutePath = isElectron() && looksAbsolute;
    const imageUrl = isAbsolutePath
      ? `file:///${imagePath.replace(/\\/g, '/')}`
      : `images/${imagePath}`;
    backgroundContainer.style.backgroundImage = `url('${imageUrl}')`;
  } else {
    backgroundContainer.style.backgroundImage = 'none';
  }
}

/**
 * Load the default background theme
 */
export function loadDefaultBackground() {
  setBackground('spacedreams.jpg');
}
```

**Design Rationale**:
- **Reusability**: Used by AppInitializer and Settings
- **Organization**: Background logic in one place
- **Standards**: Pure utility function, no side effects on import

---

### 4.2 Existing Utils (KEEP)

| File | Purpose | Changes |
|------|---------|---------|
| `aiService.js` | AI API calls, token fetching | None |
| `editorEngine.js` | Line state management | None |
| `environment.js` | `isElectron()`, `isWeb()`, `getWebAnonId()` | None |
| `webFileOps.js` | Web file upload/download | None |
| `constants.js` | API URLs, constants | None |

---

## 5. Data Flow Diagrams

### 5.1 App Initialization

```
index.js renders <App />
         ↓
App.js renders <AppInitializer />
         ↓
AppInitializer useEffect runs:
  1. Load anonId → dispatch(setAnonId)
  2. Load deviceId → dispatch(setDeviceId)  
  3. Load authId → dispatch(setAuthId)
  4. fetchUserAccount(anonId, deviceId)
         ↓
     API returns userData
         ↓
  5. dispatch(setUserData(data)) → also sets availableTokens
  6. Load settings from localStorage → dispatch(loadAllSettings)
  7. setBackground(settings.backgroundImage)
  8. Setup Electron listeners
  9. dispatch(setLoadingVisible(false))
         ↓
LoadingScreen hides, app is ready
```

### 5.2 Settings Change

```
User changes setting in Settings.js
         ↓
Settings.js dispatches updateSetting({ key, value })
         ↓
settingsSlice reducer:
  1. Updates state[key] = value
  2. Saves to localStorage
         ↓
Components using that setting re-render automatically
(e.g., MonacoEditorView re-renders if showPreviewBar changes)
```

### 5.3 File Save

```
User presses Ctrl+S
         ↓
Editor.js handleSave():
  1. Get currentFilePath from Redux (or ref)
  2. Get content from active view (editorEngine or ref)
  3. Call electronAPI.saveFile() or webFileOps
         ↓
On success:
  4. dispatch(setIsModified(false))
  5. Show status message
```

### 5.4 AI Response

```
User sends prompt in AISidebar
         ↓
AISidebar.handleSendPrompt():
  1. Get document content from editorEngine
  2. Call AI API
         ↓
API returns changes
         ↓
  3. Process changes → integrate into lines
  4. dispatch(setAIChanges({ allChangeIds, processedChanges }))
  5. Call onAIResponse (or dispatch directly to update editor)
         ↓
Editor re-renders with diff highlighting
DiffNavigation shows change count
```

---

## 6. Prop Drilling Elimination

### Before (Current)

```
App.js (15+ useState hooks)
  │
  ├── Editor (props: currentFilePath, onFileChange, onContentChange, 
  │           onSaveComplete, onEditorReady, isAIEnabled)
  │     │
  │     ├── FoldEditorView (props: 10+)
  │     ├── MonacoEditorView (props: 4)
  │     └── TextareaEditorView (props: 4)
  │
  ├── AISidebar (props: anonId, authId, developerMode, 
  │              initialAvailableTokens, onAIResponse)
  │
  └── Settings (props: anonId, authId, deviceId, userAccount,
                onClose, onThemeChanged, initialTab)
```

### After (Restructured)

```
App.js (0 useState hooks for shared state)
  │
  ├── AppInitializer (Redux writes: user.*, settings.*, ui.*, editor.*)
  │
  ├── Editor (no props needed - reads from Redux)
  │     │
  │     ├── FoldEditorView (minimal props: callbacks only)
  │     ├── MonacoEditorView (minimal props: ref, callback)
  │     └── TextareaEditorView (minimal props: ref, callback)
  │
  ├── AISidebar (1 prop: onAIResponse, or none if dispatching directly)
  │
  ├── Menus (no props - reads from Redux)
  │     │
  │     └── Settings (2 props: initialTab, onClose)
  │
  └── DiffNavigation (1 prop: onUpdate callback)
```

**Result**: Props reduced from 30+ to ~5 total

---

## 7. Migration Plan

### Phase 1: Redux Foundation (Day 1)

**Goal**: Create new slices without breaking existing code

1. Create `editorSlice.js`:
   - State: `currentFilePath`, `isModified`, `viewMode`, `isArrayView`
   - Actions: setters for each

2. Create `settingsSlice.js`:
   - State: `isAIEnabled`, `developerMode`, `backgroundImage`, `showPreviewBar`, `showMonacoLineNumbers`, `aiService`, `apiKeys`
   - Actions: setters + `loadAllSettings`

3. Extend `userSlice.js`:
   - Add: `deviceId`, `availableTokens`
   - Modify `setUserData` to calculate `availableTokens`

4. Extend `uiSlice.js`:
   - Add: `showUnsavedDialog`, `showDownloadModal`, `isLoadingVisible`
   - Actions: open/close for each

5. Update `store.js` to include new slices

**Test**: Redux DevTools shows new state, existing features still work

### Phase 2: New Components (Day 1-2)

**Goal**: Create new components that use Redux

1. Create `utils/backgroundHelper.js`:
   - Extract `setBackground` from App.js
   - Export as utility function

2. Create `LoadingScreen.js`:
   - Simple component reading `ui.isLoadingVisible`

3. Create `AppInitializer.js`:
   - Move all init logic from App.js useEffect
   - Dispatch to new slices
   - Handle Electron listeners

4. Create `Menus.js`:
   - Move modal rendering from App.js
   - Read visibility from `uiSlice`

**Test**: App still works, init happens, modals show

### Phase 3: Wire Existing Components (Day 2-3)

**Goal**: Update components to use Redux instead of props

1. Update `App.js`:
   - Remove useState for: `isModified`, `anonId`, `authId`, `deviceId`, `userAccount`, `availableTokens`, `isAIEnabled`, `developerMode`, `showPreviewBar`, `showUnsavedDialog`, `showDownloadModal`
   - Render new components: `AppInitializer`, `LoadingScreen`, `Menus`
   - Read `isAIEnabled` from Redux for conditional rendering

2. Update `Editor.js`:
   - Read `viewMode`, `isArrayView`, `currentFilePath` from Redux
   - Dispatch `setIsModified`, `setViewMode` instead of local state
   - Remove props that are now in Redux

3. Update `AISidebar.js`:
   - Read `anonId`, `authId`, `availableTokens`, `developerMode` from Redux
   - Remove those props

4. Update `Settings.js`:
   - Read user data and settings from Redux
   - Dispatch to `settingsSlice` on change
   - Remove props for user data

5. Update `MonacoEditorView.js`:
   - Read `showPreviewBar`, `showMonacoLineNumbers` from Redux
   - Remove localStorage polling

**Test**: All features work, no prop drilling

### Phase 4: Cleanup (Day 3)

**Goal**: Remove dead code, verify everything works

1. Remove unused props from all components
2. Remove unused useState from App.js
3. Remove duplicate localStorage reads
4. Update any remaining components
5. Test all functionality thoroughly

**Test Checklist**:
- [ ] App loads correctly
- [ ] File operations (new, open, save, save as)
- [ ] View mode switching
- [ ] Find/replace
- [ ] AI sidebar sends prompts
- [ ] AI changes display and navigation
- [ ] Accept/reject changes
- [ ] Settings save and load
- [ ] Background theme changes
- [ ] Unsaved changes dialog
- [ ] Web download modal
- [ ] Electron menu integration
- [ ] Token display updates

---

## 8. Summary

### What We're Doing

| Action | Rationale |
|--------|-----------|
| Create `editorSlice` | Centralize editor state, eliminate props |
| Create `settingsSlice` | Single source of truth for settings |
| Extend `userSlice` with `deviceId`, `availableTokens` | Group user data together |
| Extend `uiSlice` with modal flags | Group UI state together |
| Create `AppInitializer` | Move init logic out of App.js |
| Create `LoadingScreen` | Small, focused component |
| Create `Menus` | Centralize modal rendering |
| Create `backgroundHelper` | Reusable utility |
| Keep flat `components/` folder | Minimal complexity |
| Keep existing file names | Avoid unnecessary churn |

### What We're NOT Doing

| Avoided | Rationale |
|---------|-----------|
| Deep folder nesting | Adds complexity without benefit |
| Renaming working components | Unnecessary churn |
| Content in Redux | Performance problem |
| Find state in Redux | Transient, local concern |
| Creating tiny wrapper components | Over-engineering |
| Separate `aiSlice` | `aiChangesSlice` already exists |

### Expected Outcomes

- **App.js**: 657 lines → ~80 lines
- **Props**: 30+ → ~5
- **Redux slices**: 3 → 5 (add editorSlice, settingsSlice)
- **New files**: 5 (AppInitializer, LoadingScreen, Menus, backgroundHelper, editorSlice, settingsSlice)
- **Renamed files**: 0
- **Deleted files**: 0
- **Features lost**: 0

---

## Appendix A: File-by-File Change Summary

| File | Status | Changes |
|------|--------|---------|
| `App.js` | REFACTOR | Remove 15+ useState, add AppInitializer/LoadingScreen/Menus |
| `AppInitializer.js` | NEW | All init logic |
| `LoadingScreen.js` | NEW | Loading overlay |
| `Menus.js` | NEW | Modal container |
| `Editor.js` | REFACTOR | Use editorSlice, remove props |
| `FoldEditorView.js` | MINOR | Read isAIEnabled from Redux |
| `MonacoEditorView.js` | REFACTOR | Read settings from Redux |
| `TextareaEditorView.js` | KEEP | No changes |
| `EditorLine.js` | KEEP | No changes |
| `AISidebar.js` | REFACTOR | Remove props, use userSlice/settingsSlice |
| `DiffNavigation.js` | KEEP | Already correct |
| `DiffActionButtons.js` | KEEP | No changes |
| `Settings.js` | REFACTOR | Use settingsSlice |
| `AccountAuthSection.js` | MINOR | Read user from Redux |
| `TokenInfoModal.js` | KEEP | No changes |
| `TokenUsageLog.js` | KEEP | No changes |
| `RefreshButton.js` | KEEP | No changes |
| `ConfirmCloseModal.js` | KEEP | No changes |
| `WebMenuBar.js` | MINOR | Read settings from Redux |
| `Window.js` | KEEP | No changes |
| `store/store.js` | EXTEND | Add new reducers |
| `store/userSlice.js` | EXTEND | Add deviceId, availableTokens |
| `store/editorSlice.js` | NEW | Editor state |
| `store/settingsSlice.js` | NEW | Settings state |
| `store/uiSlice.js` | EXTEND | Add modal flags |
| `store/aiChangesSlice.js` | KEEP | No changes |
| `utils/backgroundHelper.js` | NEW | Background utility |
| `utils/aiService.js` | KEEP | No changes |
| `utils/editorEngine.js` | KEEP | No changes |
| `utils/environment.js` | KEEP | No changes |
| `utils/webFileOps.js` | KEEP | No changes |
| `utils/constants.js` | KEEP | No changes |

---

**END OF RESTRUCTURING PLAN v2**
