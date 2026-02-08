# Component Hierarchy - Scribefold Editor

## Root Component
**App.js** (`src/App.js`)
- Main application entry point
- Manages global state and refs
- Renders all top-level components

### State/Refs
- `editorRef` - Reference to editor instance for cross-component access
- `originalDocRef` - Stores original document content for diff comparison
- `showDiffView` - Controls whether diff view/change navigator is shown (from Redux)
- `settingsObject` - Settings for background image and other display options

---

## Component Tree

### 1. Global Components

#### 1.1 KeypressListeners (`src/Global/KeypressListeners.js`)
- **Purpose**: Global keyboard event handling
- **Functionality**:
  - F11 fullscreen toggle
  - Monitors fullscreen state changes
- **Children**: None

#### 1.2 AppInitializer (`src/Global/AppInitializer.js`)
- **Purpose**: Initializes app state and data
- **Functionality**:
  - Supabase auth state listener
  - Loads user data from API
  - Opens last edited file
- **Children**: None (invisible component)

#### 1.3 TopBar (`src/Global/TopBar.js`)
- **Purpose**: Navigation and controls menu bar
- **Functionality**:
  - File menu (New, Open, Save, Save As, Settings)
  - Edit menu (Undo, Redo - disabled)
  - View menu (Fullscreen, Display Settings)
  - AI menu (Show/Hide AI Chat, AI Settings, Token Usage FAQ)
  - Help menu
  - Displays current filename with modified indicator (*)
  - Keyboard shortcuts (Ctrl+S, Ctrl+O, Ctrl+N)
- **Children**: None

---

### 2. Editor Components

#### 2.1 Editor (`src/Features/Editors/Editor.js`)
- **Purpose**: Wrapper for editor implementations
- **Note**: Was used to switch between editors, now unnecessary
- **Children**:
  - `EditorCodeMirror`

#### 2.2 EditorCodeMirror (`src/Features/Editors/CodeMirror/EditorCodeMirror.js`)
- **Purpose**: CodeMirror 6 editor implementation
- **Functionality**:
  - CodeMirror editor with custom extensions
  - Line metadata (ID and AI-share state)
  - Folding regions (#chapter, #section)
  - Diff view with unifiedMergeView
  - Accept/reject functionality
- **Dependencies**:
  - `EditorCodeMirrorSetup` - Builds editor extensions
- **Children**: None

---

### 3. AI Components

#### 3.1 AiChatBar (`src/Features/AI/ChatBar/AiChatBar.js`)
- **Purpose**: Main AI chat sidebar
- **Functionality**:
  - Shows conditionally based on `aiModeActive` setting
  - Displays chat messages (user + assistant)
  - Shows login box when not authenticated
  - Shows "no tokens" box when out of tokens
- **Children**:
  - `AiChatTokenDisplay`
  - `AiChatLoginBox` (when not authenticated)
  - `AiChatNoTokensBox` (when no tokens)
  - `AiChatMessage` (mapped over messages)
  - `AiChatInputArea`

#### 3.2 AiChatToggle (`src/Features/AI/AiChatToggle.js`)
- **Purpose**: Floating button to show AI chat when hidden
- **Functionality**:
  - Shows when AI chat is off and not in fullscreen
  - Clicking enables `aiModeActive`
- **Children**: None

#### 3.3 AiChatTokenDisplay (`src/Features/AI/ChatBar/AiChatTokenDisplay.js`)
- **Purpose**: Shows token balance and usage info
- **Functionality**:
  - Displays available tokens
  - Refresh button to reload user data
  - Info button for token usage help
- **Children**:
  - `RefreshButton`
  - `InfoButton`

#### 3.4 AiChatLoginBox (`src/Features/AI/ChatBar/AiChatLoginBox.js`)
- **Purpose**: Login/signup UI for AI chat
- **Functionality**:
  - Email/password login
  - Create account with email verification
  - Shows success/error messages
- **Children**: None

#### 3.5 AiChatNoTokensBox (`src/Features/AI/ChatBar/AiChatNoTokensBox.js`)
- **Purpose**: Shown when user has no tokens
- **Functionality**:
  - Button to get more tokens via web portal
  - Auto-login magic link generation
- **Children**: None

#### 3.6 AiChatMessage (`src/Features/AI/ChatBar/AiChatMessage.js`)
- **Purpose**: Renders a single chat message
- **Functionality**:
  - User/assistant styling
  - "Thinking" state with animated dots
  - Dev mode "+" button for message details
- **Children**: None

#### 3.7 AiChatInputArea (`src/Features/AI/ChatBar/AiChatInputArea.js`)
- **Purpose**: Input area for AI prompts
- **Functionality**:
  - Textarea for user input
  - Send button and Alt+Enter shortcut
  - Calls AI API
  - Processes proposed changes
  - Opens diff view
- **Children**: None

#### 3.8 AiChatMessageDetail (`src/Features/AI/ChatBar/AiChatMessageDetail.js`)
- **Purpose**: Developer-only window for inspecting message objects
- **Functionality**:
  - Pretty-prints JSON of message data
  - Opens via "+" button on messages (dev mode only)
- **Children**: None

#### 3.9 ChangeNavigator (`src/Features/AI/Components/ChangeNavigator.js`)
- **Purpose**: Navigation bar for diff view
- **Functionality**:
  - Previous/Next change buttons
  - Accept All / Reject All buttons
  - Shows change counter
  - Auto-jump to next chunk
- **Children**: None

#### 3.10 AcceptRejectButtons (`src/Features/AI/Components/AcceptRejectButtons.js`)
- **Purpose**: Placeholder component
- **Status**: NOT USED - Empty placeholder

---

### 4. Window Components

#### 4.1 Windows (`src/Features/Windows/Windows.js`)
- **Purpose**: Container for all conditional windows
- **Functionality**:
  - Renders multiple window components
  - Each window manages its own visibility via Redux
- **Children**:
  - `SettingsWindow`
  - `SaveBeforeClosingWindow`
  - `HelpWindow`
  - `AiChatMessageDetail`
  - `FileEncryptionWindow`

#### 4.2 SettingsWindow (`src/Features/Settings/SettingsWindow.js`)
- **Purpose**: Settings modal with tabs
- **Functionality**:
  - Tab-based settings interface
  - Tabs: Display, AI, Account, Security, Developer
- **Children**:
  - `Window`
  - `SettingsDisplay`
  - `SettingsAI`
  - `SettingsAccount`
  - `SettingsGeneral` (labeled as Security)
  - `SettingsDeveloper`

#### 4.3 HelpWindow (`src/Features/Windows/HelpWindow.js`)
- **Purpose**: Help documentation window
- **Functionality**:
  - Foldable sections with help content
  - Sections: AI Help, Token Usage FAQ, Keyboard Shortcuts
- **Children**:
  - `Window`
  - `FoldableSection` (mapped)

#### 4.4 SaveBeforeClosingWindow (`src/Features/Windows/SaveBeforeClosingWindow.js`)
- **Purpose**: Warns about unsaved changes
- **Status**: NOT FULLY IMPLEMENTED - Has empty functions
- **Functionality**:
  - Should show when closing with unsaved changes
  - Options: Discard, Cancel, Save
- **Children**:
  - `Window`

#### 4.5 FileEncryptionWindow (`src/Features/Windows/FileEncryptionWindow.js`)
- **Purpose**: Encrypt/decrypt files
- **Functionality**:
  - Encrypt current file with password
  - Decrypt and open encrypted files
  - Mini keyboard for password entry
- **Children**:
  - `Window`
  - `Keyboard`

#### 4.6 KeyboardWindow (`src/Features/Windows/KeyboardWindow.js`)
- **Purpose**: Draggable on-screen keyboard
- **Functionality**:
  - Shows when `showMiniKeyboard` setting is enabled
  - Inserts characters at cursor
- **Children**:
  - `WindowMoveable`
  - `Keyboard`

#### 4.7 RightClickWindow (`src/Features/Windows/RightClickWindow.js`)
- **Purpose**: Context menu for right-click
- **Status**: COMMENTED OUT in Windows.js
- **Functionality**:
  - Context menu with options
  - Positioned at click location
- **Children**: None

---

### 5. Settings Tab Components

#### 5.1 SettingsDisplay (`src/Features/Settings/Tabs/SettingsDisplay.js`)
- **Purpose**: Display settings tab
- **Functionality**:
  - Theme selection (background images)
  - Mini keyboard toggle
  - Line number toggles
  - Preview bar toggle
- **Children**:
  - `ToggleSwitch`

#### 5.2 SettingsAI (`src/Features/Settings/Tabs/SettingsAI.js`)
- **Purpose**: AI settings tab
- **Functionality**:
  - AI Chat toggle
  - Auto-jump to next chunk toggle
  - Clear chat messages button
- **Children**:
  - `ToggleSwitch`

#### 5.3 SettingsAccount (`src/Features/Settings/Tabs/SettingsAccount.js`)
- **Purpose**: Account settings tab
- **Functionality**:
  - Login/create account
  - View web portal with auto-login
  - Logout
  - Account data display (tokens, usage)
- **Children**:
  - `AiChatLoginBox`
  - `RefreshButton`

#### 5.4 SettingsGeneral (`src/Features/Settings/Tabs/SettingsGeneral.js`)
- **Purpose**: Security settings tab (labeled as General)
- **Functionality**:
  - Encrypt file button
- **Children**: None

#### 5.5 SettingsDeveloper (`src/Features/Settings/Tabs/SettingsDeveloper.js`)
- **Purpose**: Developer settings tab
- **Functionality**:
  - Dev mode toggle
  - Debug info display
  - Diff view toggle
  - Test token email
  - Create dev account
  - Auto-login testing
  - Encryption key generation
- **Children**:
  - `ToggleSwitch`

---

### 6. Utility Components

#### 6.1 Window (`src/Features/Util/Window.js`)
- **Purpose**: Basic modal window component
- **Functionality**:
  - Title bar with close button
  - Overlay background
  - Conditional rendering based on `open` prop
- **Children**: None (renders children passed to it)

#### 6.2 WindowMoveable (`src/Features/Util/WindowMoveable.js`)
- **Purpose**: Draggable modal window
- **Functionality**:
  - Draggable via title bar
  - Initial position support
  - All Window features
- **Children**: None (renders children passed to it)

#### 6.3 RefreshButton (`src/Features/Util/RefreshButton.js`)
- **Purpose**: Refresh button with loading state
- **Functionality**:
  - Spinning animation when loading
  - Disabled state
- **Children**: None

#### 6.4 InfoButton (`src/Features/Util/InfoButton.js`)
- **Purpose**: Circular info button
- **Functionality**:
  - Simple "i" button for help/info
- **Children**: None

#### 6.5 Keyboard (`src/Features/Util/Keyboard.js`)
- **Purpose**: On-screen keyboard
- **Functionality**:
  - Full keyboard layout
  - Symbol, number, and letter rows
  - Backspace and Enter keys
  - Calls `onPress` callback
- **Children**: None

#### 6.6 ToggleSwitch (`src/Features/Util/ToggleSwitch.js`)
- **Purpose**: Toggle switch UI component
- **Functionality**:
  - On/off state with visual toggle
- **Children**: None

#### 6.7 FoldableSection (`src/Features/Util/FoldableSection.js`)
- **Purpose**: Collapsible content section
- **Functionality**:
  - Expand/collapse with +/- button
  - Scroll to on mount
  - Title bar
- **Children**: None (renders children passed to it)

---

## Redux Store Structure

### Slices
- **settingsSlice** - Display and app settings
- **userSlice** - Auth user and user data
- **editorSlice** - Editor state (filepath, modified, diff view)
- **windowSlice** - Window visibility and data
- **aiSlice** - AI chat messages
- **menuSlice** - Menu state (fullscreen, etc.)

---

## File Import Graph

### Files NOT imported anywhere (Potentially Unused):
1. `App.test.js` - Test file (can be kept)
2. `AcceptRejectButtons.js` - Empty placeholder component
3. `RightClickWindow.js` - Commented out in Windows.js
4. `WindowDraggable.js` - Not found in usage
5. `WindowMoveable.js` - Used by KeyboardWindow

### Files Used:
- All other .js files are actively used in the component tree

---

## Component Flow Summary

```
App
├── KeypressListeners (invisible)
├── AppInitializer (invisible)
├── TopBar
├── Editor
│   └── EditorCodeMirror
├── AiChatBar
│   ├── AiChatTokenDisplay
│   │   ├── RefreshButton
│   │   └── InfoButton
│   ├── AiChatLoginBox (conditional)
│   ├── AiChatNoTokensBox (conditional)
│   ├── AiChatMessage (mapped)
│   └── AiChatInputArea
├── AiChatToggle (conditional)
├── ChangeNavigator (conditional)
├── Windows
│   ├── SettingsWindow
│   │   ├── Window
│   │   ├── SettingsDisplay
│   │   │   └── ToggleSwitch
│   │   ├── SettingsAI
│   │   │   └── ToggleSwitch
│   │   ├── SettingsAccount
│   │   │   ├── AiChatLoginBox
│   │   │   └── RefreshButton
│   │   ├── SettingsGeneral
│   │   └── SettingsDeveloper
│   │       └── ToggleSwitch
│   ├── SaveBeforeClosingWindow
│   │   └── Window
│   ├── HelpWindow
│   │   ├── Window
│   │   └── FoldableSection (mapped)
│   ├── AiChatMessageDetail
│   │   └── Window
│   └── FileEncryptionWindow
│       ├── Window
│       └── Keyboard
└── KeyboardWindow
    ├── WindowMoveable
    └── Keyboard
```
