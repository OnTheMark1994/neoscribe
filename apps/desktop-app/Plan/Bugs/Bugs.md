PLease rsolve each of these issues, when they are resolved move them to a Done sectoin at the end. After the prompt list each one that was resolved and the steps the user needs to take in the applicaoitn to test that it is resolved. If it is not resolved after that do a second pass to try again also adding loggs that show all relivant information, and tell the user on the next pass to test and also to copy logs and paste them in so you can be totally sure you can resolve them after that. You can create logs and ask for them on the first pass on the first attempt to resolve if you are not sure, jsut say that in the summary at the end of the prompt.

---

## PENDING BUGS

In array view when a sugested edit is in a folded chapter and the nav selects it the chapter or sectoin should open. This was in the previous array editor functionalty, it may have been lost in the tranlation into the new one. 

- When the user places the caret on a **closed header line** (chapter/section) in array view and presses **Enter** partway through the line, the editor should **auto-open that header** and show the newly created line below it. Currently this can cause issues (including unhandled exceptions) because the new line is created inside a hidden range.

new file error
ctrl n opens a new file but also opens the save as menu for some reason
(this was seen while in monaco editor but may be project wide)
this only happens after we've made a save
so we can open a file, press new and it works propely, then open a file edit and save, then press file new and it creates new and then opens save as dialogue window. 

Web View
when we are in web view the accont portal link does not work
when we log in it does not auto populate some data until refresh (it should)
it seems to not persist the login info sometimes

Editor
when clicking on an empty array line the focus is thre because typing works but no carrat shows

settings
settings is not there for the line ids in array view this shoudl be off by default and a setting that can be switched
we shoudl just have a dedicted display tab in settings
it will have a collapsable area for array view and monaco
there will be switcehs for each part:
show array number, show side preview, etc, etc
we can do these ones later: (just leave them here)
font color (with colro selector), size
background color

Auth
when in browser web mode
the login is not persisting when computer closes and opens
when user loggs in the token data and other data is not refreshed until reload, it should hapen immediately on login, even when we press refresh after they log in its not refreshing until login so maybe its trying to used a stored id instead of referencing the auth user for the id and that only updates on refresh or some other similar error
sometime the tokens reset to 0 randomly in the database when using the applicaiotn in web, there is some flow somehwer resetting ot 0 by error, maybe when logging in or in some other situation it links up tha anon browser user with the real auth user and overrites data from the 0s in the anon tokens, or it coudl be another reason entirely 


AI
says all tokens have been used on first message 
even when they are showing and not used
navigator goes to a prposed change that is in a closed section

Monaco
talkes a very long time to load
does not show arrow fold buttons sometimes for section or chapter

AI sideber
make the estimated token have a , between 1000s 
ex 125416 to 125,416
and put an alert if its over 10,000
and a double alert if its over 100,000

Monaco
hide the #ai-hide and other tags, maybe we can structure it an a way that all tags are placed in text in a way that is easy to hide
use #tags?aiShow=<hide, show, titleOnly etc>&folded=true etc
set these on change like when eye is clicked or on open/close
we had this before it was putting #folded or #ai-hide on the line text when we opened or close it, maybe it still is



---

## DONE (Fixed - needs verification)

### 1. AI Context Menu Buttons Now Work
**Bug:** The buttons in the right click menu do not do anything
**Fix:** Rewrote AiContextMenu.js with functional onClick handlers that update #ai-hide/#ai-title/#ai-summary tags
**Files Changed:** AiContextMenu.js, AiContextMenu.css, aiUiSlice.js, EditorLine.js, SimpleMonaco.js

**Test Steps:**
1. Open a file with `#chapter` or `#section` lines
2. Enable AI panel (View → Show AI Panel)
3. **Array View:** Right-click on the +/- fold button of a chapter/section → Menu should appear with radio options
4. Click "Hide from AI" → Line should get `#ai-hide` tag appended, eye icon should change to grey
5. Right-click again → "Hide from AI" should show as selected (●)
6. Click "Share All" → `#ai-hide` tag should be removed
7. **Monaco View:** Switch to Monaco, right-click on eye glyph → Same menu should work

### 2. Save As Now Opens Dialog
**Bug:** Save As just saves without opening dialog (desktop)
**Fix:** Added separate `saveAsTrigger` in Redux, Save As now calls `saveFileAs` directly instead of `saveFile`
**Files Changed:** editorSlice.js, WebMenuBar.js, SimpleMonaco.js, EditorArray.js

**Test Steps (Electron/Desktop only):**
1. Open or create a file and make some edits
2. Click File → Save As (or Ctrl+Shift+S)
3. Save dialog should open asking where to save
4. Choose a new location/name
5. File should save to new location, title bar should update to new filename

### 3. Monaco Eye Icon Shows Grey When AI-Hide
**Bug:** No longer showing the grey/eye when ai hide is on in Monaco
**Fix:** Fixed CSS path from relative `../../../public/app-images/` to absolute `/app-images/`
**Files Changed:** MonacoEditorView.css

**Test Steps:**
1. Open a file with `#chapter Test #ai-hide` in Monaco view
2. Eye icon in the glyph margin should appear grey (not the normal eye)
3. Click the grey eye → `#ai-hide` should be removed, icon should become normal eye



