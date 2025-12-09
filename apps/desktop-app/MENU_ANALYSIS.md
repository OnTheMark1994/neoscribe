# Complete Menu Analysis - Electron Native vs Web HTML

## Current Situation

**Problem**: In Electron, there are TWO menu bars showing:
1. **Native Electron menu** (at OS level - File, Edit, View menus)
2. **WebMenuBar.js** (HTML/CSS menu bar that was meant for web only)

**Goal**: Use ONLY WebMenuBar.js for both environments, remove the native Electron menu.

---

## Electron Native Menu Structure

**Location**: `public/electron.js` → `createMenu()` function

###  File Menu
| Item | Shortcut | Action | Handler |
|------|----------|---------|---------|
| New | Ctrl+N | Creates new file | Sends `menu-new` event → `Editor.js` handles |
| Open | Ctrl+O | Opens file dialog | Sends `menu-open` event → `Editor.js` handles |
| Save | Ctrl+S | Saves current file | Sends `menu-save` event → `Editor.js` handles |
| Save As | Ctrl+Shift+S | Save as dialog | Sends `menu-save-as` event → `Editor.js` handles |
| --- | --- | --- | --- |
| Settings | Ctrl+, | Opens settings window | Opens separate BrowserWindow with #settings |
| --- | --- | --- | --- |
| Exit | - | Quits app | Calls `app.quit()` |

### Edit Menu
| Item | Shortcut | Action | Handler |
|------|----------|---------|---------|
| Undo | Ctrl+Z | Undo edit | Sends `menu-undo` event (not currently handled in renderer) |
| Redo | Ctrl+Y | Redo edit | Sends `menu-redo` event (not currently handled in renderer) |

### View Menu
| Item | Shortcut | Action | Handler |
|------|----------|---------|---------|
| Toggle Fullscreen | F11 | Fullscreen mode | Calls `mainWindow.setFullScreen()` |
| --- | --- | --- | --- |
| Themes | - | Submenu of themes | Lists all images + "Select Custom Image" |
| --- | --- | --- | --- |
| Toggle AI Window | Ctrl+Shift+W | Show/hide AI sidebar | Sends `toggle-ai-enabled` event |
| --- | --- | --- | --- |
| Cycle View Mode | Ctrl+Shift+A | Array/Monaco/Textarea | Sends `toggle-fold-view` event → `Editor.js` cycles |
| --- | --- | --- | --- |
| Fold All | Ctrl+Shift+[ | Folds all sections | Sends `fold-all` event → `Editor.js` handles |
| Unfold All | Ctrl+Shift+] | Unfolds all sections | Sends `unfold-all` event → `Editor.js` handles |

---

## WebMenuBar.js Structure

**Location**: `src/components/WebMenuBar.js`

### File Menu
| Item | Shortcut | Action | Callback |
|------|----------|---------|----------|
| New | Ctrl+N | Creates new file | `onNew()` prop |
| Open / Upload... | Ctrl+O | File upload dialog | `onOpen()` prop |
| --- | --- | --- | --- |
| Save/Download | Ctrl+S | Shows download modal | `onDownloadInfo()` prop |
| --- | --- | --- | --- |
| Settings | Ctrl+, | Opens settings modal | `onSettings()` prop |

### View Menu
| Item | Shortcut | Action | Callback |
|------|----------|---------|----------|
| Enter/Exit Full Screen | F11 | Browser fullscreen | `onToggleFullscreen()` prop |
| --- | --- | --- | --- |
| Fold All | - | Folds all sections | `onFoldAll()` prop |
| Unfold All | - | Unfolds all sections | `onUnfoldAll()` prop |
| --- | --- | --- | --- |
| Show/Hide AI Panel | - | Toggles AI sidebar | Redux `dispatch(setIsAIEnabled())` |
| --- | --- | --- | --- |
| Array View | - | Sets Array view | localStorage + event |
| Textarea View | - | Sets Textarea view | localStorage + event |
| Monaco View | - | Sets Monaco view | localStorage + event |
| --- | --- | --- | --- |
| Cycle View Mode | Ctrl+Shift+A | Cycles through views | `onToggleArrayView()` prop |

### Other Elements
| Element | Description |
|---------|-------------|
| Desktop App Link | Shows "Download Desktop App" link (web only) |
| File Name Display | Shows current file name with * if modified |
| Logo | ScribeFold AI icon |

---

## Feature Comparison

### Present in BOTH
- ✅ New (Ctrl+N)
- ✅ Open (Ctrl+O) - different dialogs (native vs upload)
- ✅ Save (Ctrl+S) - different behavior (native save vs download modal)
- ✅ Settings (Ctrl+,) - different (separate window vs modal)
- ✅ Fullscreen (F11)
- ✅ Fold All
- ✅ Unfold All
- ✅ Toggle AI
- ✅ Cycle View Mode (Ctrl+Shift+A)

### Only in Electron Native Menu
- ❌ **Save As (Ctrl+Shift+S)** - MISSING from WebMenuBar
- ❌ **Exit** - MISSING from WebMenuBar
- ❌ **Undo (Ctrl+Z)** - MISSING from WebMenuBar (and not handled in renderer)
- ❌ **Redo (Ctrl+Y)** - MISSING from WebMenuBar (and not handled in renderer)
- ❌ **Themes submenu** - MISSING from WebMenuBar
- ❌ **Toggle AI shortcut (Ctrl+Shift+W)** - MISSING from WebMenuBar
- ❌ **Fold All shortcut (Ctrl+Shift+[)** - MISSING from WebMenuBar
- ❌ **Unfold All shortcut (Ctrl+Shift+])** - MISSING from WebMenuBar

### Only in WebMenuBar
- ✅ **Direct View Mode Selectors** (Array View, Textarea View, Monaco View) - MISSING from native
- ✅ **Desktop App Link** (web only, intentional)
- ✅ **Auto-hide in fullscreen** - MISSING from native (WebMenuBar slides up/down)

---

## Key Differences in Behavior

### Save/Save As
- **Electron Native**: Directly saves to file system, shows Save As dialog when needed
- **WebMenuBar**: Shows download modal (web limitation)

### Settings
- **Electron Native**: Opens separate BrowserWindow (`#settings` route)
- **WebMenuBar**: Opens modal in same window (Redux controlled)

### Open
- **Electron Native**: Uses native file dialog
- **WebMenuBar**: Uses HTML file input (upload)

### Fullscreen
- **Electron Native**: Calls `mainWindow.setFullScreen()`
- **WebMenuBar**: Uses browser fullscreen API + auto-hide menu bar behavior

---

## Implementation Plan

### Goal
**Single unified menu bar** (`WebMenuBar.js`) that works for both web and Electron, with Electron-native menu DISABLED.

### Step 1: Disable Electron Native Menu
**File**: `public/electron.js`

```javascript
// Option A: Remove menu completely
Menu.setApplicationMenu(null);

// Option B: Hide but keep keyboard shortcuts
// (We'll use Option A and handle shortcuts in WebMenuBar)
```

### Step 2: Add Missing Features to WebMenuBar

#### 2.1 Add Save As
- **Web**: Show "Save As not available in web" message
- **Electron**: Trigger `electronAPI.saveFileAs()`

#### 2.2 Add Exit (Electron only)
- **Web**: Hide this option
- **Electron**: Call `electronAPI.quit()`

#### 2.3 Add Themes Submenu (Electron only)
- **Web**: Hide this option (themes handled in Settings)
- **Electron**: Fetch theme list via IPC, show submenu

#### 2.4 Update Shortcuts
Add keyboard shortcuts that were only in native menu:
- Ctrl+Shift+S → Save As
- Ctrl+Shift+W → Toggle AI
- Ctrl+Shift+[ → Fold All
- Ctrl+Shift+] → Unfold All

#### 2.5 Remove Cycle View Mode Button
Remove the "Cycle View Mode" option since we now have direct selectors.

### Step 3: Update Event Handlers

#### 3.1 File Operations (Electron)
Instead of `menu-new`, `menu-save` events, WebMenuBar will:
- Call same handlers as web version
- Handlers detect environment and use appropriate APIs

#### 3.2 Settings (Electron)
Instead of opening separate window:
- Use Redux `openSettings()` action
- Show Settings component in modal (like web)
- OR keep separate window behavior (environment check)

#### 3.3 Fullscreen (Electron)
Instead of `mainWindow.setFullScreen()`:
- WebMenuBar triggers via prop callback
- App.js detects Electron and calls `electronAPI.setFullscreen()`

### Step 4: Environment Detection Pattern

```javascript
// At top of WebMenuBar.js
const IS_WEB = isWeb();
const IS_ELECTRON = isElectron();

// In render
{IS_ELECTRON && (
  <>
    <button onClick={handleSaveAs}>Save As</button>
    <button onClick={handleExit}>Exit</button>
  </>
)}

// In handlers
const handleSave = () => {
  if (IS_WEB) {
    onDownloadInfo?.(); // Show download modal
  } else {
    // Trigger Editor.js save via callback
    onSave?.();
  }
};
```

### Step 5: Testing Checklist

#### Web
- [ ] All menu items visible and working
- [ ] Fullscreen auto-hide works
- [ ] No Electron-specific items showing

#### Electron
- [ ] Native menu is hidden
- [ ] WebMenuBar visible and working
- [ ] Save/Save As work
- [ ] Settings opens correctly
- [ ] Themes accessible
- [ ] Exit button works
- [ ] All keyboard shortcuts work
- [ ] Fullscreen works
- [ ] WebMenuBar auto-hide works in fullscreen

---

## Files to Modify

1. **public/electron.js**
   - Change `createMenu()` to `Menu.setApplicationMenu(null)`
   - Add IPC handlers for: quit, themes list, save as dialog

2. **src/components/WebMenuBar.js**
   - Add Save As option
   - Add Exit option (Electron only)
   - Add Themes submenu (Electron only)
   - Add missing keyboard shortcuts
   - Remove "Cycle View Mode" option
   - Add environment checks for Electron-specific features

3. **src/App.js**
   - Remove `isWeb()` check around WebMenuBar
   - Add handlers for Electron-specific actions (saveAs, quit, etc.)
   - Update fullscreen handler for Electron

4. **src/components/Editor.js**
   - Ensure save/saveAs handlers work when called from WebMenuBar

---

## Summary

Current state:
- ❌ Two menu bars in Electron (native + WebMenuBar)
- ❌ Some features only in native menu
- ❌ Inconsistent behavior between web and Electron

After implementation:
- ✅ One menu bar (WebMenuBar) for both
- ✅ All features available in both environments
- ✅ Environment-specific behavior clearly documented
- ✅ Auto-hide in fullscreen (both environments)
- ✅ No native menu in Electron
