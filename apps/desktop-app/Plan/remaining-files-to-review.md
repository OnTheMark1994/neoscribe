# Remaining Files To Review - Comprehensive List

## ✅ COMPLETED FILES

### App.js
- ✓ All wrong functions removed
- ✓ EditorContext provided
- ✓ Comprehensive comments on every variable/function
- ✓ Correct architecture
- ✓ StatusBar component integrated

### WebMenuBar.js
- ✓ Uses EditorContext (no callback props)
- ✓ Comprehensive comments
- ✓ Keyboard shortcuts use editorRef directly

### store/editorSlice.js
- ✓ Comprehensive comments on all state
- ✓ Documented localStorage sync pattern
- ✓ All actions commented

### store/statusSlice.js
- ✓ NEW - Comprehensive comments
- ✓ Proper Redux pattern for temporary messages

### components/StatusBar.js
- ✓ NEW - Comprehensive comments
- ✓ Self-contained auto-clear logic

### store/store.js
- ✓ Added statusSlice
- ✓ Documented all slices

---

## 🔄 IN PROGRESS

### components/Editor.js (1427 lines)
**Current Status**: Partially commented  
**Issues Found**:
- ✓ showStatus fixed (now uses Redux)
- ⏳ Many functions lack comprehensive comments
- ⏳ Some variables lack WHY comments
- ⏳ clearFindHighlight uses querySelector (should be refactored?)
- ⏳ window.isModified still used (should be removed)

**Needs**:
1. Add WHAT/WHY/HOW comments to every function
2. Add comments to every variable explaining purpose
3. Review if clearFindHighlight should use React state instead of DOM
4. Mark window.isModified as deprecated, plan removal
5. Document handleNew, handleOpen, handleSave flow
6. Document view mode switching logic
7. Document fold/unfold logic

---

## ⏳ HIGH PRIORITY (Core Components)

### components/AISidebar.js
**Current Status**: Not reviewed  
**Known Issues**:
- Still receives `onAIResponse` callback prop from App
- Should use EditorContext + dispatch directly

**Needs**:
1. Remove callback prop, use EditorContext
2. Add comprehensive header comment
3. Add comments to all variables/functions
4. Dispatch to Redux directly (no boomerang state)

### components/DiffNavigation.js & DiffActionButtons.js
**Current Status**: Not reviewed  
**Known Issues**:
- Receives `onUpdate` callback prop from App
- Should use EditorContext + dispatch directly

**Needs**:
1. Remove callback prop, use EditorContext
2. Add acceptChange/rejectChange methods to Editor API
3. Add comprehensive comments

### components/MonacoEditorView.js
**Current Status**: Not reviewed  
**Likely Issues**:
- May have DOM manipulation
- Decorations logic may need comments
- onContentChange callback pattern

**Needs**:
1. Comprehensive review of all functions
2. Add comments explaining Monaco integration
3. Document decoration system
4. Check if any DOM manipulation can be replaced

### components/FoldEditorView.js
**Current Status**: Not reviewed  
**Likely Issues**:
- Complex fold logic may lack comments
- EditorLine interaction needs documentation

**Needs**:
1. Add comprehensive header comment
2. Document fold/unfold logic
3. Comment all props and their purpose
4. Document EditorLine interaction

### components/TextareaEditorView.js
**Current Status**: Not reviewed  
**Likely**: Simple, but needs comments

**Needs**:
1. Add comments explaining when/why this view is used
2. Document spellcheck enablement

---

## ⏳ MEDIUM PRIORITY (Supporting Components)

### components/EditorLine.js
**Current Status**: Not reviewed  
**Known Issues**:
- May have AI context menu prop drilling

**Needs**:
1. Review props - are they all necessary?
2. Add comprehensive comments
3. Check if context menu should call Electron API directly

### components/AppInitializer.js
**Current Status**: Not reviewed  
**Needs**:
1. Document what initialization happens
2. Comment all initialization steps
3. Explain WHY in App not in components

### components/LoadingScreen.js
**Current Status**: Not reviewed  
**Needs**:
1. Document when/why loading screen shows
2. Comment Redux state usage

### components/Menus.js
**Current Status**: Not reviewed  
**Likely Contains**: Settings modal, help modal

**Needs**:
1. Document all modals
2. Comment modal state management
3. Document why modals are here not in App

### components/Settings.js
**Current Status**: Not reviewed  
**Likely Issues**:
- Large file with many settings
- May have state management issues

**Needs**:
1. Comprehensive review
2. Comment all settings sections
3. Document localStorage sync
4. Document Redux usage

---

## ⏳ LOWER PRIORITY (Utilities)

### utils/editorEngine.js
**Current Status**: Not reviewed  
**Critical**: Core parsing/folding logic

**Needs**:
1. Comprehensive header explaining what editorEngine is
2. Comment parseText, getTextFromLines, updateLinesFromText
3. Document lines array structure
4. Explain fold logic

### utils/webFileOps.js
**Current Status**: Not reviewed  
**Needs**:
1. Document uploadTextFile function
2. Explain web mode file handling
3. Comment differences from Electron mode

### utils/backgroundHelper.js
**Current Status**: Not reviewed  
**Needs**:
1. Document setBackground function
2. Explain theme system

### utils/environment.js
**Current Status**: Not reviewed  
**Needs**:
1. Document isElectron, isWeb functions
2. Explain detection logic

### utils/aiService.js
**Current Status**: Not reviewed  
**Likely**: AI API integration

**Needs**:
1. Comprehensive review
2. Document API calls
3. Comment error handling

---

## 📊 STATISTICS

### Files Status:
| Category | Completed | In Progress | Pending | Total |
|----------|-----------|-------------|---------|-------|
| App & Core | 4 | 1 | 0 | 5 |
| Components | 2 | 0 | 10 | 12 |
| Store | 3 | 0 | 4 | 7 |
| Utils | 0 | 0 | 5 | 5 |
| **TOTAL** | **9** | **1** | **19** | **29** |

### Completion: 31% (9/29 files)

### Estimated Lines Needing Comments:
| File | Lines | Estimated Comment Lines Needed |
|------|-------|-------------------------------|
| Editor.js | 1427 | ~400 |
| AISidebar.js | ~500? | ~150 |
| DiffNavigation.js | ~300? | ~100 |
| MonacoEditorView.js | ~400? | ~120 |
| FoldEditorView.js | ~600? | ~180 |
| Settings.js | ~800? | ~240 |
| editorEngine.js | ~400? | ~150 |
| **TOTAL** | ~4400 | ~1340 |

---

## 🎯 RECOMMENDED APPROACH

### Phase 1: Fix Architecture (Critical)
1. ✅ Status bar → Redux (DONE)
2. ⏳ AISidebar → EditorContext
3. ⏳ DiffNavigation → EditorContext
4. ⏳ Remove window.isModified
5. ⏳ Review clearFindHighlight DOM manipulation

### Phase 2: Comment Core Files (High Priority)
1. ⏳ Editor.js - every function/variable
2. ⏳ editorEngine.js - core parsing logic
3. ⏳ MonacoEditorView.js - Monaco integration
4. ⏳ FoldEditorView.js - fold view logic

### Phase 3: Comment Supporting Files (Medium Priority)
1. ⏳ AISidebar.js
2. ⏳ DiffNavigation.js
3. ⏳ Settings.js
4. ⏳ All other components

### Phase 4: Comment Utilities (Lower Priority)
1. ⏳ All utils files

### Phase 5: Final Review
1. ⏳ Verify every file has comprehensive comments
2. ⏳ Check no DOM manipulation remains
3. ⏳ Verify no prop drilling
4. ⏳ Test all flows work

---

## 📝 COMMENT STANDARDS (From Status Bar Example)

Every variable needs:
- **WHAT**: What is this variable?
- **WHY**: Why is it in this component/file?
- **WHERE FROM**: Where does it come from? (Redux, props, local, computed)
- **USED BY**: Who reads/uses it?

Every function needs:
- **WHAT**: What does this function do?
- **WHY HERE**: Why is it in this component/file?
- **HOW**: How does it work? (for complex logic)
- **WHEN**: When is it called?
- **REPLACES**: If it replaces old code, what and why?

Every component needs:
- **WHAT**: What is this component?
- **WHY**: Why does it exist separately?
- **USES**: What does it use (Context, Redux, props)?
- **ARCHITECTURE**: How does it fit in the app?

---

## 🚀 NEXT STEPS

1. **Continue with Editor.js** - Add comments to remaining functions
2. **Update AISidebar** - Remove callback, use EditorContext
3. **Update DiffNavigation** - Remove callback, use EditorContext
4. **Systematically review** - Go through list above file by file

**Current Focus**: Editor.js comprehensive commenting
