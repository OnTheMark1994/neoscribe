# Unused Files Analysis - Scribefold Editor

## Files That Can Be Safely Removed

### 1. AcceptRejectButtons.js
**Path**: `src/Features/AI/Components/AcceptRejectButtons.js`
**Status**: ✅ SAFE TO REMOVE
**Reason**: Empty placeholder component, not imported anywhere
**Evidence**: Only found in its own file, no imports found in codebase

---

### 2. WindowDraggable.js
**Path**: `src/Features/Util/WindowDraggable.js`
**Status**: ✅ SAFE TO REMOVE
**Reason**: Duplicate of WindowMoveable.js, not used anywhere
**Evidence**: Only found in its own file and CSS file, no imports
**Note**: WindowMoveable.js is actively used by KeyboardWindow.js and has identical functionality

---

### 3. RightClickWindow.js
**Path**: `src/Features/Windows/RightClickWindow.js`
**Status**: ⚠️ PARTIALLY UNUSED
**Reason**: Imported but commented out in Windows.js
**Evidence**: 
- Line 20 in Windows.js: `{/* <RightClickWindow/> */}`
- Has Redux state in WindowSlice.js but UI is disabled
**Recommendation**: Can be removed if right-click context menu feature is not needed

---

## Files That Should Be Kept

### Editor.js
**Path**: `src/Features/Editors/Editor.js`
**Status**: ⚠️ CONSIDER REMOVING
**Reason**: Thin wrapper component, comments say "not necessary"
**Current Use**: Used by App.js
**Recommendation**: Could be refactored to directly use EditorCodeMirror in App.js

---

## Summary

| File | Status | Action |
|------|--------|--------|
| AcceptRejectButtons.js | Unused | ✅ Remove |
| WindowDraggable.js | Unused | ✅ Remove |
| RightClickWindow.js | Commented out | ⚠️ Remove if not needed |
| Editor.js | Unnecessary wrapper | ⚠️ Consider refactoring |
| App.test.js | Test file | Keep (standard file) |

## CSS Files to Remove (if JS is removed)

- `src/Features/Util/WindowDraggable.css` (if WindowDraggable.js is removed)
- `src/Features/Windows/RightClickWindow.css` (if RightClickWindow.js is removed)

## Redux State Cleanup

If RightClickWindow.js is removed, consider cleaning up:
- `windowSlice.showRightClickWindow`
- `windowSlice.rightClickWindowLeft`
- `windowSlice.rightClickWindowTop`
- `windowSlice.optionsType`
- `closeRightClickWindow` action

---

## Recommended Removal Order

1. **Safe to remove immediately**:
   - AcceptRejectButtons.js
   - WindowDraggable.js
   - WindowDraggable.css

2. **Remove if feature not needed**:
   - RightClickWindow.js
   - RightClickWindow.css
   - Related Redux state

3. **Consider refactoring**:
   - Editor.js (replace with direct EditorCodeMirror import in App.js)
