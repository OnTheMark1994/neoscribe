In array view when a sugested edit is in a folded chapter and the nav selects it the chapter or sectoin should open. This was in the previous array editor functionalty, it may have been lost in the tranlation into the new one. 

- When the user places the caret on a **closed header line** (chapter/section) in array view and presses **Enter** partway through the line, the editor should **auto-open that header** and show the newly created line below it. Currently this can cause issues (including unhandled exceptions) because the new line is created inside a hidden range.
