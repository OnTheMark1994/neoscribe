# Deploying ScribeFold AI to Render.com

This app runs as both an Electron desktop app and a static web app.

## Render.com Static Site Configuration

- **Build Command:** `npm install && npm run build:web`
- **Publish Directory:** `build`

## Runtime Environments

The React UI is shared, but behavior differs slightly depending on where it runs.

### Electron Desktop App

- **Entry:** `public/electron.js` (main process) + `public/preload.js` (IPC bridge).
- **Menus:** Native OS menu bar defines File / View / Help etc.
  - File open/save use native dialogs and encrypted file handling.
  - Keyboard shortcuts (Ctrl/Cmd+N, Ctrl/Cmd+O, Ctrl/Cmd+S, etc.) are wired as
    Electron menu accelerators.
- **Settings:**
  - Settings open in a dedicated BrowserWindow (hash `#settings` / `#settings-ai`).
  - `Settings` communicates with the main process via `window.electronAPI` for
    theme listing, custom theme selection, and persistence.
- **File Access:**
  - Can read/write local files directly (via Electron + Node APIs).
  - Last opened file path is stored and reopened on launch.
- **Storage:**
  - Uses `electron-store` for anon ID and some persistent settings.
  - Also uses `localStorage` for UI-toggles like AI enabled, developer mode.
- **Themes:**
  - Supports built-in themes plus user-selected custom images from the local
    file system (stored as absolute paths and loaded via `file:///` URLs).

### Web App (Browser / Render.com)

- **Entry:** Same React bundle, built with `react-scripts build` and served as
  a static site.
- **Menus:**
  - Native OS menu is not available.
  - Instead, `WebMenuBar` renders a top bar with File and View menus.
  - Keyboard shortcuts are handled in-browser:
    - Ctrl/Cmd+N – New document (clears editor).
    - Ctrl/Cmd+O – Open / Upload text file.
    - Ctrl/Cmd+S – Open "Save/Download" modal.
    - Ctrl/Cmd+, – Open Settings modal.
- **Settings:**
  - Settings open as an in-page modal using the shared `Window` component.
  - No IPC calls are made; settings are stored in `localStorage` only.
- **File Access:**
  - Browser cannot access the local file system directly.
  - File operations are adapted:
    - **Open** – Uses an `<input type="file">` to upload a `.txt` file and
      load its contents into the editor.
    - **Save/Download** – Opens a modal explaining limitations and provides a
      button to download the current document as a text file.
    - A secondary button in the modal opens the desktop app download page in a
      new tab.
- **Storage:**
  - Uses `localStorage` for anon ID, AI enabled flag, developer mode, and theme
    selection.
  - Anon ID is generated via `crypto.getRandomValues` when Electron is not
    present.
- **Themes:**
  - Uses a hardcoded list of built-in themes that ship in `public/images/`.
  - If a previously-saved absolute path (from Electron custom theme) is
    encountered in the browser, the app falls back to a default theme image
    (e.g. `spacedreams.jpg`).

## Files Added for Web Support

- `src/utils/environment.js` - `isElectron()`, `isWeb()`, `getWebAnonId()`.
- `src/utils/webFileOps.js` - `uploadTextFile()`, `downloadTextFile()`.
- `src/components/WebMenuBar.js` - Web menu bar component.
- `src/components/WebMenuBar.css` - Menu bar styles.
- `src/components/Window.js` / `Window.css` - Reusable modal window with title
  bar and close button for Settings and download flows in web mode.
