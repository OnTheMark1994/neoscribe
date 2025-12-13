PLease rsolve each of these issues, when they are resolved move them to a Done sectoin at the end. After the prompt list each one that was resolved and the steps the user needs to take in the applicaoitn to test that it is resolved. If it is not resolved after that do a second pass to try again also adding loggs that show all relivant information, and tell the user on the next pass to test and also to copy logs and paste them in so you can be totally sure you can resolve them after that. You can create logs and ask for them on the first pass on the first attempt to resolve if you are not sure, jsut say that in the summary at the end of the prompt.


make a plan for each, then code it up, do for all 3, then at the end put a brief sumary (2 lines or so for each resolved bug), and what to do to test it. Continue until all of them are resolved, do not stop to ask questions, run commands, or anything else, please do the entire coded up solution. 

---

## PENDING BUGS

This is just the basic to get it working at minimum to be useable at all 
should put them in order of necessity 
then do in logical batches

had to do a reject all for some changes, not sure how much was in it, may need to redo a lot of them. 

1 Editor line focus 
when clicking on an empty array line the focus is thre because typing works but no carrat shows.
So maybe just put focus on the first array item when a file opens (or on new file) 

2: Web View auth autologin link
when we are in web view the accont portal link does not work
when we log in it does not auto populate some data until refresh (it should)
it seems to not persist the login info sometimes
so in web view we need the view account portal auto login link to work correctly.



3: settings
settings is not there for the line ids in array view this shoudl be off by default and a setting that can be switched
we shoudl just have a dedicted display tab in settings
it will have a collapsable area for array view and one for monaco
there will be switches for each part. the switches can be all toghether not each in their own seperate setting-section, just one setting-section with all of the radiobuttons for each of the settings on the same view. show array number, show side preview, etc, etc. 
some things we can add later: (dont have to add them now unless its easy but can keep them mind)
font color (with colro selector), size
background color

4: AI sideber udpate 
(just small ui changes more than a bug)
make the estimated token have a , between 1000s 
ex 125416 to 125,416
and put an alert if its over 10,000
and a double alert if its over 100,000






Optamizations:
In the AIContextMenu
it calls for ai show or hide 
recomputeVisibleLines
which cycles through every line, maybe 10,000 lines just to change one visibleLines line to sync with the lines array

on load with many (over 10k) lines it is super slow
but monaco opens it right away
we need to optamize
or switch to monaco
but the ai suggestions do not work
and the section and chanpter headers sometimes do not work 


Auth
when in browser web mode
the login is not persisting when computer closes and opens
when user loggs in the token data and other data is not refreshed until reload, it should hapen immediately on login, even when we press refresh after they log in its not refreshing until login so maybe its trying to used a stored id instead of referencing the auth user for the id and that only updates on refresh or some other similar error
sometime the tokens reset to 0 randomly in the database when using the applicaiotn in web, there is some flow somehwer resetting ot 0 by error, maybe when logging in or in some other situation it links up tha anon browser user with the real auth user and overrites data from the 0s in the anon tokens, or it coudl be another reason entirely 




Monaco
does not show arrow fold buttons sometimes for section or chapter

Monaco ai responses is a tottal mess 
it does not work well at all. 
shold look at that example and go through all of it slowly. 


Monaco
hide the #ai-hide and other tags, maybe we can structure it an a way that all tags are placed in text in a way that is easy to hide
use #tags?aiShow=<hide, show, titleOnly etc>&folded=true etc
set these on change like when eye is clicked or on open/close
we had this before it was putting #folded or #ai-hide on the line text when we opened or close it, maybe it still is

## IN PROGRESS (needs testing)

for both of these we need to update the server in render.js which means merging the current branch with main (not done yet)

Tokesn resetting to 0 sometimes
in progress, see server.js
we udpated to make sure there are not duplicate auth ids so it can not add auth id to an anon row with 0 tokens and then later pull the wrong row because it pulls the first matching auth id

1: False no tokens:
!Alert:
(not tested yet, server may not be in sync with updated changes)
when user is logged in with tokens
and first message is sent 
response is user has no tokens (even when they do and the number is displaying)
on second message send (maybe pressed refresh buton) it did work
so we need to talk through what app state will be at each point and see where the break in logic is, the api takes the id of the user ad a param not the tokens the user has so some id must be wrong to be setn wrong on the inital call to the api


---

## DONE

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



- When the user places the caret on a **closed header line** (chapter/section) in array view and presses **Enter** partway through the line, the editor should **auto-open that header** and show the newly created line below it. Currently this can cause issues (including unhandled exceptions) because the new line is created inside a hidden range.

new file error
ctrl n opens a new file but also opens the save as menu for some reason
(this was seen while in monaco editor but may be project wide)
this only happens after we've made a save
so we can open a file, press new and it works propely, then open a file edit and save, then press file new and it creates new and then opens save as dialogue window.

2: Ai-hide not working:
the lines that have ai hide on the lines are still being sent to the ai. A line that has ai hide to true needs to not be set at all, or if title only it needs to send the title header line only and none of the ones nested in it, we can loop thorugh the arrays and use the level and ai hide statt to see if a line shoul be sent, then send the result of that loop. If a chapter is hidden everyhting in it is not sent, if it is showing it is deteremined by the headers in it, a sectoin in a shown chapter shows by default but it can be hidden or title only and in that case it will not show
ex:
content
chapter
content
sectoin
content
section (title only)
content
section (hidden)
content
chatpter (hidden)
sectoin
concontenttent
section (hidden)
content
section (title only)
content
goes to:
content
chapter
content
sectoin
content
section (title only)
(nothing in it because title only)
(no hidden section at all)
(no hidden chapter or anythnig in it)

3: when navigator goes to a prposed change that is in a closed section we want that section to open, we already have functions to handle this so we just need to connect them. This was working in a previous version but it now is not, we need to ensure the proper function is present and being called. It may be a fucntion in the ediotr engine, but it may be in another place. 


bug 4:
right click menu radiobutton
there is a new bug where the ai hide setting does not show in the radio buttons of the right lcick menu, this data should come from the line that the right was triggered on and comefrom the line data, we can maybe put that necessary data in the relivant redux slice related to that menu. 

bug 5:
child eye icon display
when a parent (like a chapter) is hidden the blue eyes on the children (the sections) should show as a grey eye (the png with the eye but its grey instead of blue, there should be a png in the same directlry that says what it is, maybe its being used for some ai share optino already too so add it for this situation in a way that does not use any extra processign power) in the output after this describe what the solutions you considered were and which you chose and why. 

