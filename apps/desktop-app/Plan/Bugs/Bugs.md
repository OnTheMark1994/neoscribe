In array view when a sugested edit is in a folded chapter and the nav selects it the chapter or sectoin should open. This was in the previous array editor functionalty, it may have been lost in the tranlation into the new one. 

- When the user places the caret on a **closed header line** (chapter/section) in array view and presses **Enter** partway through the line, the editor should **auto-open that header** and show the newly created line below it. Currently this can cause issues (including unhandled exceptions) because the new line is created inside a hidden range.

when we are in web view the accont portal link does not work

AccountAuthSection.js:116 Failed to open URL externally: Error: Electron API not available - cannot open externally
    at openExternalLink (AccountAuthSection.js:113:1)
    at onClick (AccountAuthSection.js:207:1)
openExternalLink	@	AccountAuthSection.js:116
onClick	@	AccountAuthSection.js:207
<button>		
AccountAuthSection	@	AccountAuthSection.js:205
<AccountAuthSection>		
Settings	@	Settings.js:680
<Settings>		
Menus	@	Menus.js:83
<Menus>		
App	@	App.js:34
<App>		
./src/index.js	@	index.js:12
options.factory	@	react refresh:37
__webpack_require__	@	bootstrap:22
(anonymous)	@	startup:7
(anonymous)	@	startup:7


when we log in it does not auto populate some data until refresh (it should)

it seems to not persist the login aitj info sometimes