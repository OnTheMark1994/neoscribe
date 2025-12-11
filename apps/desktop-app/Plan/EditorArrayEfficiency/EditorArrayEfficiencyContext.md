# Editor Array & Monaco – Context Overview

## What this plan is about
- **Goal:** Make the `EditorArray` view and the `SimpleMonaco` view share the **same document**, AI metadata, and folding state, while being **much more efficient**.
- This document explains **only the concepts and flows**. You can understand the main EAE plan without reading or having the code.

---

## Main pieces involved

- **Redux `editorSlice`**
  - Holds the current document **text content** and the **file path/name**.
  - Is the single “source of truth” for the raw text.

- **`editorEngine` (in utils/editorEngine)**
  - Internal model built from the text.
  - Stores an array of **lines** with metadata, for example:
    - `text`: the actual line content
    - `level`: structure level (chapter, section, normal line)
    - `open` / `hidden`: whether a header or its children are folded
    - `id` and other metadata (AI flags, etc.)
  - Provides functions to:
    - Parse text into `lines`.
    - Compute **which lines are visible** (folding / nesting).
    - Update lines when the user types, presses Enter, or AI modifies content.

- **`EditorArray` (array view)**
  - React component that renders the document as a **list of lines**.
  - Uses `editorEngine` to get:
    - The array of all `lines`.
    - The **visible subset** of those lines for display.
  - Handles per-line edits (typing, Enter, backspace, etc.) via `editorEngine` APIs.

- **`SimpleMonaco` (Monaco editor view)**
  - Shows the same document in a **code-like editor**.
  - Uses its own text model but will be wired to **sync text to/from `editorEngine`**.
  - Folding in Monaco is separate but will consume metadata from `editorEngine` (chapter/section levels, open/hidden where appropriate).

- **AI integration**
  - AI tools read from the `editorEngine` lines and write changes back into that structure.
  - This ensures that AI changes appear in both EditorArray and (after sync) SimpleMonaco.

- **View switch (Array ↔ Monaco)**
  - Top menu buttons change a **Redux view state**.
  - In `App.js`, a `useEffect` watches this state:
    - Before switching views, it **syncs the current unsaved editor state** into the shared model (via `editorEngine` and/or Redux).
    - Then it updates a local `viewMode` string in `App.js` to show the correct editor component.
  - Result: switching views should keep text and structure in sync even if you didnt save to disk yet.

---

## Current problems this plan addresses

- **Performance issues in `EditorArray`**
  - Folding and visibility are recomputed **on every render**.
  - Enter key may trigger a **full re-parse of the entire document**, even when only one line changed.

- **Two editors, two models**
  - `EditorArray` uses `editorEngine.lines`.
  - `SimpleMonaco` has its own text model and builds its own `lines` view.
  - Fold state and some structure are **not shared**, so views can be inconsistent.

- **Unsaved state on view switch**
  - We want switching between views to keep all edits, even if they are not written to file yet.
  - The `App.js` view switch flow needs to coordinate with `editorEngine` / Redux to ensure this.

---

## High-level solution

1. **Central shared model**
   - Use `editorEngine` as the single place that knows:
     - The full text (`lines` → joined text and back).
     - Structural metadata (chapter/section levels, AI metadata).
     - Folding state (`open` / `hidden`).

2. **Cached visible lines**
   - Instead of recomputing which lines are visible every render, compute them only **when an event happens**:
     - File load / content change.
     - Fold / unfold.
     - AI or bulk modifications.

3. **Localized updates**
   - When the user types, presses Enter, or toggles a chapter/section:
     - Only recompute the lines that actually changed, or the affected subtree.
     - Avoid re-parsing the entire document unless absolutely necessary.

4. **Shared text source for both editors**
   - On switching to Monaco:
     - Build the Monaco model from `editorEngine` text.
   - On switching back to array view:
     - Read Monaco text and load it into `editorEngine`.

5. **Metadata-based folding**
   - Treat folding as metadata (line `open`/`hidden`, levels) instead of encoding folds directly into the text.
   - Makes it easier to share folding behaviour between views and to persist it.

---

## Where the view switch fits

- **Trigger:** user clicks a view button in the top menu.
- **Redux:** a view-related slice (or similar) updates to say "use Array" or "use Monaco".
- **`App.js` useEffect:**
  - Sees the change in Redux view state.
  - Calls a function that **syncs the current editor content** and metadata into `editorEngine` / Redux so unsaved work is not lost.
  - Updates a local `viewMode` state variable so the UI shows `EditorArray` or `SimpleMonaco`.
- The EAE plan assumes this behaviour and focuses on how to make the shared model + editors cooperate efficiently.

---

## How to use this context with the EAE file

- When reading any part of **EditorArrayEfficiency.md**, ask:
  - **Which component is this about?** (`WebMenuBar`, `EditorArray`, `SimpleMonaco`, `App.js` view switch, `editorEngine`, AI tools)
  - **Is this changing the shared model, the UI, or both?**
- The EAE file then:
  - Describes the **current behaviour**.
  - Identifies **inefficiencies** and mismatches between views.
  - Proposes **stepwise refactors** to make everything go through `editorEngine` efficiently.

If you understand this Context document, you should be able to follow each section of the EAE plan without seeing the actual code.
