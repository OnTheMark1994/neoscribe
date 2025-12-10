
Editor.js
DIsplays editors conditionaly based on redux state


EditorMonaco.js
// what this file is and what it does

State:
variable name
// wht it does and why its here (why not in redux or parent etc)

veriable2 name
description
 
function foldAll();
folds all with monaco built in api, called when redux fold all increments
It is in thic component because it is monaco specific 
it is called externally from menu.js by a redux state cahnge

function x();
siple description

Flow 1: File Open
user opens a file
this sets x state in redux
if in monaco view:
the redux state causes the editor content to change

Flow 2: View type change:
user selects monaco view from top menu
redux state updates
useEffect in Ediotrs.js changes
EditorMonaco shows
Editor monaco useEffect calls a function to show the content
etc

Flow: user typing
in monaco when the user types x happens
then y 
etc