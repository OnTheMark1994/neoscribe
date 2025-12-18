/*
 
 
  */
import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Editor from '@monaco-editor/react';
import './EditorMonaco.css';

function assertLineIds(editorRef){

  
  /*

  
2m
1m

please review the docs folder of the scribefold-editor for context
I’ll scan apps/scribefold-editor/Docs to understand the intended architecture, conventions, and any planned features. I’ll start by listing the docs folder, then open the key files and summarize the important points that affect how we should work in the codebase.

Analyzed
apps/scribefold-editor/Docs
I’m going to read the core docs files (CodingPrinciples, FileStructure, FeatureFlows, DatabaseTables, DevelopmentPlan) and then summarize the key architectural expectations + any “must follow” conventions that should guide edits in scribefold-editor.

Docs review (scribefold-editor)
Here’s what stands out from apps/scribefold-editor/Docs and what it implies for how we should build/modify code.

CodingPrinciples.txt (project rules)
Keep components simple
Minimal lines + minimal complexity.
Prefer efficient solutions
Minimize expensive operations (explicitly mentions “min big O”).
Stay organized
Feature-specific styles go in feature/component-specific .css files (ex: Window.css), not dumped into App.css.
Maximize reuse
Reuse existing components instead of making slightly different copies.
Comments/docs
Wants meaningful comments and also keeping docs updated as changes are made.
State management
Avoid prop drilling / “boomerang state”; avoid passing redux state down as props unnecessarily.
Avoid “defensive defaults” complexity
Example says: don’t add extra !== false wrappers, just read settingsObject?.monacoStickyTopBar etc.
This aligns strongly with your global memory rule about reusable building blocks and not creating duplicates.

FileStructure.txt (intended architecture)
High-level intended structure (key takeaways):

Global
TopBar.js (top menu)
AppInitializer.js (auth + load redux state from Supabase)
ReduxStore.js and slices in Global/ReduxSlices/*
Features/Editors
Editor.js decides which editor to render
Two editors:
EditorArray (custom line-based editor; proposed changes inserted between lines)
EditorMonaco (Monaco-based alternative)
Features/AI
Chat UI components
Shared UI components like ChangeNavigator, AcceptRejectButtons
Features/Settings
Settings window with tab components
Features/Util
Generic reusable UI, especially Window.js
Features/Windows
Concrete windows like Help / RightClick / SaveBeforeClosing plus an aggregator Windows.js
Important implication: when adding anything “window-like”, it should wrap Window.js rather than inventing another window shell.

FeatureFlows.txt (behavior + UX contract)
This is essentially the spec. Biggest items:

Main layout
Background container
Editor area on left
AI chat bar on right
TopBar spans editor area only (not covering AI sidebar)
EditorArray behavior
Enter splits a line at cursor into next line
Ctrl+F brings custom search UI (highlights occurrences)
Spellcheck uses browser spellcheck; toggleable via settings
Chapters/sections concept
Recognize #chapter and #section
Folding behavior, depth/margins, and an “eye glyph” for AI sharing
Right-click menu actions include:
Fold/open, fold/open all sections
AI share options (send all/title-only/hide)
Placement of right-click menu depends on coordinate space
Compute top/left relative to the container you mount in (so positioning is correct)
Saving metadata in-document
Metadata stored in-line when saving, stripped on load.
Example tag format: line content #tags#ai-share=<tag>#folded=true...
Possible extras: cursor position, scroll position.
EditorMonaco goals
Wants custom folding based on #chapter/#section
Transparent styling, no code-editor tooltips
Custom gutter glyphs for AI share/hide
Identified risk: showing proposed changes / accept-reject cleanly was hard in prototype
AI proposed changes navigation
Proposed change navigator jumps to selected change, opens folded sections automatically when needed.
This doc is a strong “expected behavior contract” for future work.

DatabaseTables.txt (Supabase model, token logic)
Tables:

free_grants
Used to ensure free token grants aren’t duplicated across accounts/devices.
token_log
“All actions that change token counts must be done through a function that changes this.”
Important invariant for server-side logic.
users
Contains auth_id, token counts, subscription metadata, device_id, etc.
Notes: password field is mentioned for auto-login-link generation; should be handled carefully.
Even though this is editor docs, it signals how AppInitializer / account settings will eventually map to Supabase.

DevelopmentPlan.txt (timeline + Monaco requirements)
Confirms completed phases:

UI layout, settings/windows, monaco basic embedding done. Next planned:
Monaco additional
chapter/section folding
gutter glyphs for ai-hide options
persistent-per-session line ids + index validation testing
File IO
AI chat to API + parse response + put into redux
Connect monaco to AI response
diff view
accept/reject buttons inserted “best place”
jump-to-change behavior
It also includes a concrete Monaco “prompt/spec” with requirements:

Conditional sticky top bar, preview scrollbar, line numbers based on settingsObject
Stable unique per-line IDs (at least per session)
Ability to pull data with per-line ids + custom show/hide attribute for sending to API
Diff view between original and API-produced content
O(1) or low complexity operations where possible
How I’d use this context going forward
Follow the folder responsibilities
Editor logic stays in Features/Editors/*
Shared UI pieces go in Features/Util or Features/AI/Components (if AI-specific).
Avoid duplicating primitives
Use Window.js for any popup/window UI.
Keep styles local
Component-level .css files rather than pushing into global css.
Design for IDs + metadata
A lot of future work depends on stable “line identity” independent of line number.
What do you want to do next with this context?
Pick one and I’ll drive it:

[Option A] Review EditorMonaco.js vs the Monaco spec above and identify gaps (ids, glyphs, folding, diff).
[Option B] Review how settings are read (settingsObject) and ensure Monaco options map 1:1 without extra complexity.
[Option C] Confirm the intended “metadata in saved text” tag format and implement the parse/serialize helpers (reusable, used by both editors + file IO).
Status
Completed: Reviewed and summarized all files in apps/scribefold-editor/Docs.
Feedback submitted


I want to implement a line id system in monaco, I want this to be triggerd when the send button in the ai chat is called, but the monaco editor is in the EditorMonaco. what is the best way to implement that? At the end of this I want to press send and have an array of lines with ids log, then I add a few lines and press send again and the ids persist in their corrct places with new lines getting new ids in between, called from the send butto. what is the best way to implement that? Just a high level plan. I've included code for reference:


    // Get number of lines
    // For each line get the content and decorations (__aiHide or __lineId) using the index
      // If no line id we add one and mark that index as needing the line id inserted into monaco decorations
    // Now we have an array of lines with content and tags (like id)
    // And an array of index values for the lines that need their ids inserted into monaco
      // How do we insert those ids into monaco decorations?
    // Now we have an array of objects for the lines with attributse for content, id, aishow
      // we can further process it to see if all of that shoudl be sent to the api
    // Then we can send it to the api
    // If the user changes the content adding lines while api is thinking we can know where to places the respones 
      // We will pull the editor content and ids in the same way to create an array
      // We wil cycle thorugh that array of lines freshly built from monaco and plae the respones into that content based on macthing ids
    // Now we have the contentModivied lines array
      // We create a string from that and compare the two with a DiffView (built into monaco) 

    so: 
    a function to create the array of lines from monaco with the content and ids
      takes just the ref and builds the array and calls other functions (adding ids as necessary)
    a function to assert the array of lines to update missing ids into monaco decorations
      takes editor ref, lines array, array of index's that need upate
    a function to filter out the ones that shoudl be sent to the api
      for now just returning it as it is, we will add this filter later

    send function
      lines = createLinesArrayFunction
      resonse = fetch(url, lines)
        response is an array of objects with content and lines numbers
      create diff response
      we can add this part later, we are just trying to get the ids working now
        so we will press send and just log the ids, then I will add content, then we will log them again 
        to see if the ids persisted on the existing lines moving correctly when I add lines in the middle 
      etc

  */
}

export default function EditorMonaco({ monacoEditorRef }) {
  const [value, setValue] = useState('');

  // User preferences that should affect Monaco rendering.
  const settingsObject = useSelector(state => state.settingsSlice.settingsObject);

  const initialValue = useMemo(() => {
    return [
      '#chapter Introduction',
      '',
      'This is a basic Monaco editor instance.',
      '',
      '#section Notes',
      '- You can type here.',
    ].join('\n');
  }, []);

  return (
    <div className="editorMonacoContainer">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        defaultValue={initialValue}
        onChange={(nextValue) => setValue(nextValue ?? '')}
        onMount={(editor) => {
          // This is the critical wiring step:
          // The Monaco <Editor/> component provides the actual editor instance here.
          // We store it into the ref that was created in App.js so other components
          // (like the AI chat Send button) can access Monaco content.
          if(monacoEditorRef){
            monacoEditorRef.current = editor
          }
        }}
        beforeMount={(monaco) => {
          // Create a theme that matches vs-dark but uses a transparent editor background.
          monaco.editor.defineTheme('scribefold-transparent-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
              // Remove the blue focus border and the current-line border/highlight.
              'focusBorder': '#00000000',
              'editor.lineHighlightBorder': '#00000000',
              'editor.lineHighlightBackground': '#00000000',
              'editor.hoverHighlightBackground': '#00000000',

              // Remove selection / occurrence / "clicked word" highlights.
              'editor.selectionHighlightBackground': '#00000000',
              'editor.selectionHighlightBorder': '#00000000',
              'editor.wordHighlightBackground': '#00000000',
              'editor.wordHighlightBorder': '#00000000',
              'editor.wordHighlightStrongBackground': '#00000000',
              'editor.wordHighlightStrongBorder': '#00000000',
              'editor.symbolHighlightBackground': '#00000000',
              'editor.symbolHighlightBorder': '#00000000',

              // Ensure the real Monaco caret is visible.
              'editorCursor.foreground': '#FFFFFF',

              'editor.background': '#00000000',
              'editorGutter.background': '#00000000',
              'minimap.background': '#00000000',
            },
          });
        }}
        theme="scribefold-transparent-dark"
        options={{
          // Line number gutter.
          lineNumbers: settingsObject?.showMonacoLineNumbers ? 'on' : 'off',

          // Sticky top bar / sticky scroll.
          stickyScroll: { enabled: Boolean(settingsObject?.monacoStickyTopBar) },

          // Right-side overview/minimap.
          minimap: { enabled: Boolean(settingsObject?.showPreviewBar) },
          overviewRulerLanes: settingsObject?.showPreviewBar ? 3 : 0,
          overviewRulerBorder: false,

          // Remove the focused/hovered line styling.
          renderLineHighlight: 'none',
          renderLineHighlightOnlyWhenFocus: false,

          // Remove "click word" / occurrences / selection highlight overlays.
          selectionHighlight: false,
          occurrencesHighlight: 'off',

          fontSize: 14,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />
    </div>
  );
}
