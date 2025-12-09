# Desktop App Restructuring Plan

## Executive Summary

This document outlines the complete restructuring of the ScribeFold AI desktop app to eliminate prop drilling, centralize state management in Redux, improve code organization, and create a scalable, maintainable codebase.

---

## 1. New Project Structure

```
src/
├── App.js                           # Minimal root component, orchestrates major sections
├── App.css
├── index.js
├── index.css
│
├── store/                           # Redux state management (centralized)
│   ├── store.js                     # Main store configuration
│   ├── userSlice.js                 # User state (anonId, authId, deviceId, userData)
│   ├── uiSlice.js                   # UI state (modals, menus, settings visibility)
│   ├── editorSlice.js               # NEW: Editor state (viewMode, currentFile, isModified)
│   ├── aiSlice.js                   # NEW: AI state (isAIEnabled, changes, sidebar state)
│   ├── settingsSlice.js             # NEW: Settings state (all settings centralized)
│   └── index.js                     # Export all actions/selectors
│
├── components/
│   ├── core/                        # Core application components
│   │   ├── AppInitializer.js        # Handles initialization, IDs, background loading
│   │   ├── LoadingScreen.js         # Loading overlay component
│   │   └── BackgroundContainer.js   # Background image container
│   │
│   ├── layout/                      # Layout components
│   │   ├── MainLayout.js            # Main app layout wrapper
│   │   ├── PageContainer.js         # Page container with AI sidebar awareness
│   │   └── StatusBar.js             # Status bar at bottom
│   │
│   ├── menus/                       # Menu system (centralized)
│   │   ├── Menus.js                 # All modals and menus container
│   │   ├── WebMenuBar.js            # Web-only menu bar (existing)
│   │   ├── ConfirmCloseModal.js     # Unsaved changes dialog
│   │   ├── DownloadModal.js         # Web download modal
│   │   └── FullscreenManager.js     # Fullscreen state handler
│   │
│   ├── editor/                      # Editor system
│   │   ├── EditorContainer.js       # Main editor orchestrator
│   │   ├── EditorViewRouter.js      # Routes to correct view based on viewMode
│   │   ├── views/
│   │   │   ├── ArrayEditorView.js   # Array/fold view (renamed from FoldEditorView)
│   │   │   ├── MonacoEditorView.js  # Monaco view (existing, refactored)
│   │   │   └── TextareaEditorView.js # Textarea view (existing)
│   │   ├── EditorLine.js            # Line component for array view (existing)
│   │   ├── EditorFind.js            # Find/replace UI component
│   │   └── EditorToolbar.js         # Optional toolbar for editor controls
│   │
│   ├── ai/                          # AI-related components
│   │   ├── AISidebar.js             # AI sidebar (existing, refactored)
│   │   ├── DiffNavigation.js        # Diff navigation controls (existing)
│   │   ├── DiffActionButtons.js     # Accept/reject buttons (existing)
│   │   ├── TokenInfoModal.js        # Token info modal (existing)
│   │   └── TokenUsageLog.js         # Token usage log (existing)
│   │
│   ├── settings/                    # Settings system
│   │   ├── Settings.js              # Settings container (existing, refactored)
│   │   ├── SettingsModal.js         # Settings modal wrapper
│   │   ├── AccountAuthSection.js    # Account auth section (existing)
│   │   └── RefreshButton.js         # Refresh button (existing)
│   │
│   └── common/                      # Reusable UI components
│       └── Window.js                # Generic window/modal component (existing)
│
├── utils/                           # Utility functions
│   ├── aiService.js                 # AI API calls (existing)
│   ├── editorEngine.js              # Editor state engine (existing)
│   ├── environment.js               # Environment detection (existing)
│   ├── webFileOps.js                # Web file operations (existing)
│   ├── constants.js                 # Constants (existing)
│   ├── helpers.js                   # NEW: General helper functions
│   └── backgroundHelper.js          # NEW: Background image loading helper
│
└── hooks/                           # NEW: Custom React hooks
    ├── useElectronEvents.js         # Hook for Electron event listeners
    ├── useFileOperations.js         # Hook for file operations
    ├── useEditorKeyboard.js         # Hook for editor keyboard shortcuts
    └── useSettings.js               # Hook for settings management
```

---

## 2. Redux State Organization

### 2.1 Store Structure

```javascript
// store/store.js
{
  user: {
    anonId: string | null,
    authId: string | null,
    deviceId: string | null,
    userData: object | null,  // Full user account data
    loading: boolean,
    error: string | null
  },
  
  editor: {
    currentFilePath: string | null,
    isModified: boolean,
    viewMode: 'array' | 'monaco' | 'textarea',
    content: string,
    isArrayView: boolean,  // Toggle for array view visual style
    findState: {
      isVisible: boolean,
      query: string,
      matches: array,
      currentIndex: number
    }
  },
  
  ai: {
    isEnabled: boolean,
    developerMode: boolean,
    allChangeIds: array,
    currentChangeIdIndex: number,
    processedChanges: object,
    autoAdvanceOnResolve: boolean,
    availableTokens: number | null,
    sidebarState: {
      messages: array,
      isThinking: boolean,
      tokenEstimate: object | null
    }
  },
  
  settings: {
    backgroundImage: string,
    showPreviewBar: boolean,
    showMonacoLineNumbers: boolean,
    aiService: string,
    apiKeys: object,
    editorSettings: object  // Any other editor-specific settings
  },
  
  ui: {
    isSettingsOpen: boolean,
    settingsTab: string | null,
    showUnsavedDialog: boolean,
    showDownloadModal: boolean,
    isFullscreen: boolean,
    isLoadingScreenVisible: boolean
  }
}
```

### 2.2 New Redux Slices

#### editorSlice.js
```javascript
// Manages editor-specific state
Actions:
- setCurrentFilePath(path)
- setIsModified(boolean)
- setViewMode(mode)
- setContent(content)
- setIsArrayView(boolean)
- setFindVisible(boolean)
- setFindQuery(query)
- setFindMatches(matches)
- setCurrentFindIndex(index)
- clearFind()
```

#### aiSlice.js
```javascript
// Consolidates AI-related state
Actions:
- setIsEnabled(boolean)
- setDeveloperMode(boolean)
- setAvailableTokens(number)
- setAIChanges({ allChangeIds, processedChanges })
- clearAIChanges()
- nextChange()
- previousChange()
- addMessage(message)
- setIsThinking(boolean)
- setTokenEstimate(estimate)
- clearMessages()
```

#### settingsSlice.js
```javascript
// All settings in one place
Actions:
- setBackgroundImage(path)
- setShowPreviewBar(boolean)
- setShowMonacoLineNumbers(boolean)
- setAiService(service)
- setApiKeys(keys)
- loadSettingsFromStorage()  // Thunk action
- saveSettingsToStorage()    // Thunk action
- resetToDefaults()
```

---

## 3. Component Hierarchy & Responsibilities

### 3.1 App.js

**Purpose**: Minimal orchestrator that renders major sections

**State**: NONE (all in Redux)

**Responsibilities**:
- Render Redux Provider
- Render AppInitializer
- Render MainLayout
- Render Menus component

**JSX Structure**:
```jsx
<Provider store={store}>
  <AppInitializer />
  <MainLayout />
  <Menus />
</Provider>
```

**NO functions** - completely declarative

---

### 3.2 AppInitializer.js

**Purpose**: Handle all initialization logic (IDs, background, settings)

**Redux Access**: 
- Reads: Nothing initially
- Writes: user.*, settings.*, ui.isLoadingScreenVisible

**Responsibilities**:
- Load anonId (Electron or web)
- Load deviceId (Electron only)
- Load authId from localStorage
- Dispatch all IDs to Redux
- Load background image
- Call fetchUserAccount and save to Redux
- Hide loading screen after initialization
- Set up Electron event listeners (onSettingsUpdated, onAnonIdReady, etc.)

**Functions**:
```javascript
function initializeApp()
function loadUserIds()
function loadBackgroundImage()
function setupElectronListeners()
```

**Display**: Nothing (pure logic component)

**Sub-components**: None

---

### 3.3 LoadingScreen.js

**Purpose**: Display loading overlay

**Redux Access**:
- Reads: ui.isLoadingScreenVisible

**Responsibilities**:
- Show/hide based on Redux state
- CSS transition for fade out

**Display**:
```jsx
<div className={`loading-screen ${!visible ? 'hidden' : ''}`}>
  <div className="loading-text">Loading...</div>
</div>
```

**Functions**: None (pure presentation)

---

### 3.4 BackgroundContainer.js

**Purpose**: Render background image

**Redux Access**:
- Reads: settings.backgroundImage

**Responsibilities**:
- Render background div
- Update background-image CSS from Redux state

**useEffect**:
- Watch settings.backgroundImage and update DOM directly

**Display**:
```jsx
<div id="backgroundContainer" className="background-container"></div>
```

---

### 3.5 MainLayout.js

**Purpose**: Main application layout structure

**Redux Access**:
- Reads: ai.isEnabled, editor.viewMode

**Responsibilities**:
- Render WebMenuBar (web only)
- Render PageContainer with EditorContainer
- Render AISidebar (if AI enabled)
- Render DiffNavigation
- Render StatusBar

**JSX Structure**:
```jsx
<div className="App">
  {isWeb() && <WebMenuBar />}
  <PageContainer>
    <EditorContainer />
  </PageContainer>
  {aiIsEnabled && <AISidebar />}
  <DiffNavigation />
  <StatusBar />
</div>
```

**Functions**: None (layout only)

---

### 3.6 Menus.js

**Purpose**: Centralized container for ALL modals and dialogs

**Redux Access**:
- Reads: ui.showUnsavedDialog, ui.showDownloadModal, ui.isSettingsOpen, ui.settingsTab
- Writes: ui.* (to close modals)

**Responsibilities**:
- Render ConfirmCloseModal if ui.showUnsavedDialog is true
- Render DownloadModal if ui.showDownloadModal is true
- Render Settings in Window if ui.isSettingsOpen is true
- Handle modal close actions by dispatching Redux actions

**JSX Structure**:
```jsx
<>
  {showUnsavedDialog && <ConfirmCloseModal onSave={...} onDiscard={...} onCancel={...} />}
  {showDownloadModal && <DownloadModal onClose={...} />}
  {isSettingsOpen && (
    <Window title="Settings" onClose={...}>
      <Settings />
    </Window>
  )}
</>
```

**Functions**:
```javascript
function handleSaveAndClose() // Dispatch save action, close dialog
function handleDiscard()      // Dispatch discard action, close dialog
function handleCancel()       // Just close dialog
function handleCloseSettings() // Dispatch closeSettings()
```

---

### 3.7 ConfirmCloseModal.js

**Purpose**: Unsaved changes confirmation dialog

**Props**: onSave, onDiscard, onCancel (from Menus.js)

**Redux Access**: None (pure presentation)

**Display**:
- Modal overlay
- Three buttons: Save and Exit, Discard Changes, Cancel

**Functions**: None (calls props)

---

### 3.8 DownloadModal.js

**Purpose**: Web-only download information modal

**Props**: onClose

**Redux Access**:
- Reads: editor.currentFilePath, editor.content

**Responsibilities**:
- Show download instructions
- Provide "Download Text File" button
- Provide "Download Desktop App" link

**Functions**:
```javascript
function handleDownloadFile() // Use webFileOps to download content
```

---

### 3.9 EditorContainer.js

**Purpose**: Main editor orchestrator and logic hub

**Redux Access**:
- Reads: editor.* (all), ai.isEnabled, ai.allChangeIds, ai.currentChangeIdIndex
- Writes: editor.* (updates)

**Responsibilities**:
- Handle file operations (new, open, save, saveAs)
- Handle keyboard shortcuts (Ctrl+S, Ctrl+F, etc.)
- Manage find/replace state
- Coordinate with editorEngine for line management
- Expose editor API to parent via ref
- Route to correct EditorViewRouter

**Functions**:
```javascript
function handleNew()
function handleOpen()
function handleSave()
function handleSaveAs()
function handleKeyDown(e)
function handleContentChange(content)
function handleFileChange(filePath)
function getCurrentContent() // Get content from active view
function renderEditor()
function foldAll()
function unfoldAll()
function cycleViewMode()
function switchToViewMode(mode)
```

**Display**:
```jsx
<div className="editor-container">
  <EditorToolbar />
  <EditorViewRouter />
  {isFindVisible && <EditorFind />}
</div>
```

**Sub-components**:
- EditorToolbar (optional)
- EditorViewRouter
- EditorFind (conditional)

---

### 3.10 EditorViewRouter.js

**Purpose**: Route to correct view component based on viewMode

**Redux Access**:
- Reads: editor.viewMode

**Props**: Pass necessary props to child views

**Responsibilities**:
- Render ArrayEditorView if viewMode === 'array'
- Render MonacoEditorView if viewMode === 'monaco'
- Render TextareaEditorView if viewMode === 'textarea'

**Display**:
```jsx
{viewMode === 'array' && <ArrayEditorView {...props} />}
{viewMode === 'monaco' && <MonacoEditorView {...props} />}
{viewMode === 'textarea' && <TextareaEditorView {...props} />}
```

**Functions**: None

---

### 3.11 ArrayEditorView.js (formerly FoldEditorView.js)

**Purpose**: Array/fold editor view with EditorLine components

**Props**:
- editorRef
- visibleLines (from parent)
- onToggleFold (from parent)
- onContentChange (from parent)

**Redux Access**:
- Reads: editor.isArrayView, ai.isEnabled, ai.currentChangeId

**Responsibilities**:
- Render visible lines using EditorLine components
- Render DiffActionButtons for lines with changes

**Display**:
```jsx
<div id="editor-display" className="editor-display" ref={editorRef}>
  {visibleLines.map(({ line, index, displayDepth }) => (
    <React.Fragment key={line.id || index}>
      <EditorLine {...lineProps} />
      {line.proposedChangeType && <DiffActionButtons {...diffProps} />}
    </React.Fragment>
  ))}
</div>
```

**Functions**: None (pure presentation)

---

### 3.12 MonacoEditorView.js

**Purpose**: Monaco code editor view

**Props**:
- monacoRef
- onContentChange (from parent)

**Redux Access**:
- Reads: editor.content, ai.isEnabled, settings.showPreviewBar, settings.showMonacoLineNumbers

**Responsibilities**:
- Render Monaco editor
- Set up custom folding provider
- Handle decorations (AI eyes, etc.)
- Apply theme and settings

**Functions**:
```javascript
function handleEditorDidMount(editor, monaco)
function updateDecorations(editor, monaco)
function toggleAiHideForLine(lineNumber)
```

**Display**:
```jsx
<div className="monaco-editor-container">
  <Editor {...monacoConfig} />
</div>
```

---

### 3.13 TextareaEditorView.js

**Purpose**: Simple textarea editor view

**Props**:
- textareaRef
- onContentChange (from parent)

**Redux Access**:
- Reads: editor.content

**Responsibilities**:
- Render plain textarea
- Handle content changes

**Display**:
```jsx
<textarea
  ref={textareaRef}
  className="editor-textarea"
  value={content}
  onChange={onContentChange}
/>
```

**Functions**: None

---

### 3.14 EditorFind.js

**Purpose**: Find/replace UI overlay

**Redux Access**:
- Reads: editor.findState.*
- Writes: editor.findState.*

**Responsibilities**:
- Render find input and navigation buttons
- Handle find query changes
- Navigate between matches
- Close find box

**Display**:
```jsx
<div className="find-box">
  <input value={query} onChange={...} />
  <button onClick={findPrevious}>↑</button>
  <button onClick={findNext}>↓</button>
  <span>{currentIndex + 1} / {matches.length}</span>
  <button onClick={close}>✕</button>
</div>
```

**Functions**:
```javascript
function handleQueryChange(value)
function findNext()
function findPrevious()
function close()
```

---

### 3.15 AISidebar.js

**Purpose**: AI chat and token management sidebar

**Redux Access**:
- Reads: user.anonId, user.authId, ai.*, settings.developerMode
- Writes: ai.sidebarState.*, ai.availableTokens

**Responsibilities**:
- Render chat messages
- Handle prompt input
- Call AI API
- Display token info
- Refresh token count
- Show token modal

**Functions**:
```javascript
function handleSendPrompt()
function updateTokenCount()
function handleTokenInfoClick()
function addMessage(role, content)
function refreshAvailableTokens()
```

**Display**:
```jsx
<div className="ai-sidebar">
  <TokenDisplay />
  <MessageList />
  <PromptInput />
  {showTokenModal && <TokenInfoModal />}
</div>
```

**Sub-components**:
- TokenDisplay (inline or separate)
- MessageList (inline or separate)
- PromptInput (inline or separate)
- TokenInfoModal (conditional)

---

### 3.16 DiffNavigation.js

**Purpose**: Navigate between AI-proposed changes

**Redux Access**:
- Reads: ai.allChangeIds, ai.currentChangeIdIndex
- Writes: ai.currentChangeIdIndex

**Responsibilities**:
- Show current change number
- Navigate to next/previous change
- Handle auto-advance toggle

**Display**:
```jsx
<div className="diff-navigation">
  <button onClick={previous}>←</button>
  <span>{currentIndex + 1} / {total}</span>
  <button onClick={next}>→</button>
  <button onClick={toggleAutoAdvance}>
    {autoAdvance ? '🔄' : '⏸️'}
  </button>
</div>
```

**Functions**:
```javascript
function handleNext()      // Dispatch nextChange()
function handlePrevious()  // Dispatch previousChange()
function handleToggleAutoAdvance() // Dispatch toggleAutoAdvance()
```

---

### 3.17 Settings.js

**Purpose**: Settings management UI

**Redux Access**:
- Reads: settings.*, user.* (for account tab)
- Writes: settings.*

**Responsibilities**:
- Render settings tabs (General, AI, Account)
- Load settings from localStorage on mount
- Save settings to localStorage on change
- Sync settings to Redux
- Handle theme selection
- Handle editor view mode selection
- Manage AI service selection

**Functions**:
```javascript
function loadSettings()
function saveSettings()
function handleThemeChange(theme)
function handleViewModeChange(mode)
function handleAiServiceChange(service)
function handleToggleSetting(key)
```

**Display**:
```jsx
<div className="settings-container">
  <TabBar />
  {activeTab === 'general' && <GeneralTab />}
  {activeTab === 'ai' && <AITab />}
  {activeTab === 'account' && <AccountTab />}
</div>
```

**Sub-components**:
- GeneralTab (inline or separate)
- AITab (inline or separate)
- AccountTab (includes AccountAuthSection)

---

### 3.18 StatusBar.js

**Purpose**: Bottom status bar for messages

**Redux Access**:
- Reads: ui.statusMessage (new state)

**Responsibilities**:
- Display status messages
- Auto-clear after timeout

**Display**:
```jsx
<div id="status" className="status">
  {statusMessage}
</div>
```

**Functions**: None (controlled by Redux + auto-clear timeout)

---

## 4. Data Flow Diagrams

### 4.1 App Initialization Flow

```
App.js (mounts)
  ↓
AppInitializer (useEffect runs)
  ↓
Load IDs (anonId, deviceId, authId)
  ↓
Dispatch to Redux → user.anonId, user.deviceId, user.authId
  ↓
Fetch user account data
  ↓
Dispatch to Redux → user.userData
  ↓
Load background image
  ↓
Dispatch to Redux → settings.backgroundImage
  ↓
Load all settings from localStorage
  ↓
Dispatch to Redux → settings.*
  ↓
Hide loading screen
  ↓
Dispatch to Redux → ui.isLoadingScreenVisible = false
```

### 4.2 File Save Flow

```
User presses Ctrl+S
  ↓
EditorContainer.handleSave() (from keyboard hook)
  ↓
Read editor.currentFilePath from Redux
  ↓
Get current content from active view (array/monaco/textarea)
  ↓
Call window.electronAPI.saveFile() or webFileOps
  ↓
On success:
  - Dispatch setIsModified(false)
  - Show status message
```

### 4.3 AI Response Flow

```
User sends AI prompt
  ↓
AISidebar.handleSendPrompt()
  ↓
Call AI API
  ↓
Receive changes
  ↓
Dispatch setAIChanges() → ai.*
  ↓
Update editorEngine lines
  ↓
Trigger editor re-render
  ↓
DiffNavigation shows changes
  ↓
User navigates/accepts/rejects
```

### 4.4 Settings Change Flow

```
User changes setting in Settings component
  ↓
Settings.handleSettingChange()
  ↓
Save to localStorage
  ↓
Dispatch to Redux → settings.*
  ↓
Components observing settings.* automatically update
  (e.g., MonacoEditorView watches settings.showPreviewBar)
```

### 4.5 View Mode Switch Flow

```
User toggles view mode (menu or shortcut)
  ↓
EditorContainer.switchToViewMode(newMode)
  ↓
Get current content from active view
  ↓
Dispatch setViewMode(newMode) → editor.viewMode
  ↓
Save to localStorage
  ↓
EditorViewRouter automatically switches to new view
  ↓
New view renders with content
```

---

## 5. Prop Drilling Elimination

### Before (Current State)
```
App.js
  ├─ props: anonId, authId, deviceId, isModified, isAIEnabled, developerMode, etc.
  ├─ Editor
  │   ├─ props: currentFilePath, onFileChange, onContentChange, isAIEnabled
  │   └─ MonacoEditorView
  │       └─ props: isAIEnabled, content, onContentChange
  └─ AISidebar
      └─ props: anonId, authId, developerMode, initialAvailableTokens, onAIResponse
```

### After (Restructured)
```
App.js
  ├─ NO PROPS
  ├─ EditorContainer
  │   ├─ Redux: editor.*, ai.isEnabled
  │   └─ EditorViewRouter
  │       └─ MonacoEditorView
  │           └─ Redux: editor.content, ai.isEnabled, settings.*
  └─ AISidebar
      └─ Redux: user.*, ai.*, settings.developerMode
```

**Result**: ZERO prop drilling. All data flows through Redux.

---

## 6. Helper Functions Organization

### 6.1 utils/helpers.js

**Purpose**: General helper functions not tied to specific domain

**Functions**:
```javascript
function escapeHtml(text)
function formatTimestamp(date)
function generateUniqueId()
function debounce(func, wait)
function throttle(func, wait)
```

### 6.2 utils/backgroundHelper.js

**Purpose**: Background image loading and management

**Functions**:
```javascript
function setBackground(imagePath)
function getBackgroundPath(imagePath)
function loadDefaultBackground()
```

### 6.3 utils/editorEngine.js (existing)

**Purpose**: Core editor line management

**Functions**:
```javascript
function parseText(text)
function getLines()
function setLines(lines)
function getTextFromLines()
function updateLinesFromText(text)
```

### 6.4 utils/aiService.js (existing)

**Purpose**: AI API interactions

**Functions**:
```javascript
function callDeepSeekServerAPI(...)
function fetchUserAccount(...)
function fetchUserTokens(...)
function normalizeUserTokenData(...)
function processChanges(...)
function integrateChangesIntoLines(...)
```

---

## 7. Custom Hooks

### 7.1 useElectronEvents.js

**Purpose**: Centralize Electron event listener setup

**Usage**:
```javascript
function AppInitializer() {
  useElectronEvents({
    onAnonIdReady: (id) => dispatch(setAnonId(id)),
    onDeviceIdReady: (id) => dispatch(setDeviceId(id)),
    onSettingsUpdated: (settings) => handleSettingsUpdate(settings),
    onToggleAI: () => dispatch(toggleAI()),
    onSetBackground: (path) => dispatch(setBackgroundImage(path))
  });
}
```

### 7.2 useFileOperations.js

**Purpose**: File operation logic (open, save, new)

**Returns**: { handleNew, handleOpen, handleSave, handleSaveAs }

**Usage**:
```javascript
function EditorContainer() {
  const { handleNew, handleOpen, handleSave, handleSaveAs } = useFileOperations();
  
  // Use in keyboard shortcuts or menu handlers
}
```

### 7.3 useEditorKeyboard.js

**Purpose**: Centralize editor keyboard shortcuts

**Usage**:
```javascript
function EditorContainer() {
  useEditorKeyboard({
    onSave: handleSave,
    onFind: () => dispatch(setFindVisible(true)),
    onEscape: () => dispatch(setFindVisible(false))
  });
}
```

### 7.4 useSettings.js

**Purpose**: Settings loading and persistence

**Returns**: { loadSettings, saveSettings }

**Usage**:
```javascript
function Settings() {
  const { loadSettings, saveSettings } = useSettings();
  
  useEffect(() => {
    loadSettings();
  }, []);
}
```

---

## 8. Migration Strategy

### Phase 1: Redux Setup
1. Create new Redux slices (editorSlice, aiSlice, settingsSlice)
2. Add them to store.js
3. Test store configuration

### Phase 2: Core Components
1. Create AppInitializer.js
2. Create LoadingScreen.js
3. Create BackgroundContainer.js
4. Refactor App.js to use new components
5. Test initialization flow

### Phase 3: Menus Consolidation
1. Create Menus.js
2. Move modal logic from App.js
3. Create DownloadModal.js (extract from App.js)
4. Update ConfirmCloseModal to work with Menus.js
5. Test all modals

### Phase 4: Editor Refactoring
1. Rename FoldEditorView to ArrayEditorView
2. Create EditorViewRouter.js
3. Create EditorContainer.js (move logic from Editor.js)
4. Refactor MonacoEditorView to use Redux
5. Create EditorFind.js
6. Test all editor views and switching

### Phase 5: Settings Centralization
1. Move all settings to settingsSlice
2. Create SettingsModal wrapper if needed
3. Update Settings.js to use Redux
4. Remove settings props from all components
5. Test settings load/save

### Phase 6: AI Consolidation
1. Create aiSlice with all AI state
2. Update AISidebar to use Redux
3. Update DiffNavigation to use Redux
4. Remove AI props from all components
5. Test AI functionality

### Phase 7: Cleanup
1. Remove all unused props
2. Remove all prop drilling
3. Add PropTypes or TypeScript interfaces
4. Update tests
5. Documentation

---

## 9. Testing Checklist

After restructuring, verify:

- [ ] App initializes correctly (IDs loaded, background set)
- [ ] Loading screen shows and hides
- [ ] File operations work (new, open, save, save as)
- [ ] All editor views work (array, monaco, textarea)
- [ ] View mode switching works
- [ ] Find/replace works in all views
- [ ] Keyboard shortcuts work (Ctrl+S, Ctrl+F, etc.)
- [ ] AI sidebar works (send prompt, receive changes)
- [ ] Diff navigation works (next, previous, accept, reject)
- [ ] Settings load and save correctly
- [ ] Settings changes reflect immediately in UI
- [ ] All modals work (unsaved changes, download, settings)
- [ ] Web menu bar works (web only)
- [ ] Fullscreen works (web only)
- [ ] Electron events work (desktop only)
- [ ] Background theme changes work
- [ ] No console errors
- [ ] No prop drilling warnings
- [ ] All state in Redux (verify with Redux DevTools)

---

## 10. Benefits of This Structure

### Readability
- Each component has a single, clear responsibility
- No more 600+ line files
- Easy to find where things happen

### Maintainability
- State changes in one place (Redux slices)
- No prop drilling = fewer refactors when state changes
- Clear data flow = easier debugging

### Scalability
- Easy to add new features (just add Redux actions/state)
- Components can be reused easily
- New developers can understand structure quickly

### Performance
- Redux memoization prevents unnecessary re-renders
- Smaller components = better React reconciliation
- Clear separation of concerns

### Developer Experience
- Redux DevTools for debugging
- Hot reloading works better with smaller components
- Type safety can be added easily (TypeScript)

---

## 11. Code Style Guidelines

### Redux Actions
- Use descriptive action names (setIsModified, not setModified)
- Always validate payload types
- Use thunks for async operations

### Components
- Max 200 lines per component (if larger, split)
- Props should be specific, not "...props"
- Use PropTypes or TypeScript
- Prefer functional components with hooks

### File Organization
- One component per file
- Co-locate CSS with component
- Group related components in folders

### Naming Conventions
- Components: PascalCase (EditorContainer.js)
- Utilities: camelCase (editorEngine.js)
- Redux: camelCase for actions/reducers
- Constants: UPPER_SNAKE_CASE

---

## 12. Future Enhancements

After restructuring, these will be easier to implement:

1. **Undo/Redo**: Add history to editorSlice
2. **Multi-file tabs**: Add tabs array to editorSlice
3. **Themes**: Add theme system to settingsSlice
4. **Plugins**: Add plugin system with Redux middleware
5. **Collaboration**: Add WebSocket state to separate slice
6. **Testing**: Easy to unit test Redux logic and components separately
7. **Mobile**: Reuse Redux logic, swap UI components
8. **Offline Mode**: Add persistence middleware to Redux

---

## 13. Summary

This restructuring plan:

✅ **Eliminates all prop drilling** (max 0 levels, everything in Redux)  
✅ **Centralizes state** (user, editor, AI, settings, UI all in Redux)  
✅ **Organizes components** (clear hierarchy, single responsibilities)  
✅ **Creates reusable helpers** (utils and custom hooks)  
✅ **Simplifies App.js** (from 657 lines to ~20 lines)  
✅ **Makes codebase scalable** (easy to add features, test, maintain)  
✅ **Follows best practices** (separation of concerns, DRY, SOLID)  
✅ **Maintains all functionality** (no features lost, only reorganized)  
✅ **Improves developer experience** (easier to understand, debug, extend)  

**Implementation Time Estimate**: 3-5 days for experienced developer working full-time

**Risk Level**: Low (incremental changes, can test at each phase)

**Breaking Changes**: None (internal refactor only, no API changes)

---

## Appendix A: Component Function Reference

### EditorContainer.js Functions
```javascript
handleNew() → Create new document
handleOpen() → Open file dialog
handleSave() → Save to current file
handleSaveAs() → Save to new file
handleKeyDown(e) → Handle keyboard shortcuts
getCurrentContent() → Get content from active view
renderEditor() → Force editor re-render
foldAll() → Fold all sections
unfoldAll() → Unfold all sections
cycleViewMode() → Cycle through view modes
switchToViewMode(mode) → Switch to specific view
handleFileChange(path) → Update current file path
handleContentChange(content) → Mark as modified
```

### AISidebar.js Functions
```javascript
handleSendPrompt() → Send user prompt to AI
updateTokenCount() → Calculate and update token estimate
handleTokenInfoClick() → Show token info modal
addMessage(role, content) → Add message to chat
refreshAvailableTokens() → Fetch latest token balance from API
handleTokenRefresh() → Manual token refresh button handler
```

### Settings.js Functions
```javascript
loadSettings() → Load all settings from localStorage
saveSettings() → Save all settings to localStorage
handleThemeChange(theme) → Change background theme
handleViewModeChange(mode) → Change editor view mode
handleAiServiceChange(service) → Change AI service provider
handleToggleSetting(key) → Toggle boolean setting
handleApiKeyChange(service, key) → Update API key for service
syncSettingsToRedux() → Push settings to Redux store
```

### Menus.js Functions
```javascript
handleSaveAndClose() → Save file and close app
handleDiscard() → Discard changes and close
handleCancel() → Cancel close operation
handleCloseSettings() → Close settings modal
handleCloseDownload() → Close download modal
```

### EditorFind.js Functions
```javascript
handleQueryChange(value) → Update find query
findNext() → Navigate to next match
findPrevious() → Navigate to previous match
close() → Close find box
clearHighlights() → Remove all find highlights
```

---

## Appendix B: Redux Selector Reference

### Common Selectors
```javascript
// User selectors
selectAnonId = state => state.user.anonId
selectAuthId = state => state.user.authId
selectDeviceId = state => state.user.deviceId
selectUserData = state => state.user.userData

// Editor selectors
selectCurrentFilePath = state => state.editor.currentFilePath
selectIsModified = state => state.editor.isModified
selectViewMode = state => state.editor.viewMode
selectEditorContent = state => state.editor.content

// AI selectors
selectIsAIEnabled = state => state.ai.isEnabled
selectAvailableTokens = state => state.ai.availableTokens
selectAllChangeIds = state => state.ai.allChangeIds
selectCurrentChangeIndex = state => state.ai.currentChangeIdIndex

// Settings selectors
selectBackgroundImage = state => state.settings.backgroundImage
selectShowPreviewBar = state => state.settings.showPreviewBar
selectDeveloperMode = state => state.settings.developerMode

// UI selectors
selectIsSettingsOpen = state => state.ui.isSettingsOpen
selectShowUnsavedDialog = state => state.ui.showUnsavedDialog
```

---

**END OF RESTRUCTURING PLAN**
