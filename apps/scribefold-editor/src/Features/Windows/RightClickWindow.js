/*
  
  This displays in the App.js in the background when a an action is dispatched

  action dispatch:
    when the action is dispatched all data needed to perform the action in this window should be saved into redux
    we will have a section in the window slice specifically for this right click window to keep it compartmentalized

  Displays conditionally based on the redux windowSlice.showRightClickWindow state as set by the windowSlice openRightClick redux action

  example:
  onClick => windowSlice.showRightClickWindow({x: x position, y: y position})
  the x and y are obtained from the click event and used in the style={{ }} to position the window
 
  some will have hover windows where when hovered over the additional content will show
    there will be css with display hidden and  hover css classes that show the subwindows
      like rightClick:hover.rightClickSubwindow{ 
  some will have actions that happen based on the data in redux (like fold header actions etc)

  the thing that the right click action happend on determines what options show by setting a rightClickWindowType key in the openRightClickWindow action 

  rightClickWindowType: "chapterHeader" or "sectionHeader" etc in redux
  different options arrays for each in the optionsArrays
  
  rightClickWindowType set to null by the action by default so there is a default right click window if none is set
  
  optionsArrays: {
    // the rightClickWindowType keyword
    chapterHeader: [
      // The data that will show in the right click window
      {
        title: "",
        onClick: ()=>{}, // put ()=>{} if no function to avoid errors like when there are just sub options in it 
        ...
      },
      ...
    ],
    sectionHeader: [
      ...
    ],
    ...
  }

*/
import React from 'react';
import { useSelector } from 'react-redux';
export default function RightClickWindow() {

  // Determines if the right click window shows
  const showWindow = useSelector(state => state.windowSlice.showRightClickWindow) 
  const optionsType = useSelector(state => state.windowSlice.rightClickWindowType) 
  const left = useSelector(state => state.windowSlice.rightClickWindowLeft) 
  const top = useSelector(state => state.windowSlice.rightClickWindowTop) 

  // Contains the array of options in the right click window
  const optionsArrays = {
    // ... as described above
  }

  // Get the array from the optionsArrays based on the redux.windowSlice.optionsType 
  const options = optionsType? optionsArrays[optionsType] : optionsArrays["default"] 

  // The window shows conditionally based on redux windowSlice.showRightClickWindow
  if(!showWindow) return null

  return (
    // We use inline css here because its a variable  
    <div className={"rightClickWindow"} style={{"left": left, "top": top}}>
      {/* Optoins as defined by optionsArrays */}
      {options.map(optionJSON => (
        // The options
        <div className={""} onClick={optionJSON.onClick}>
          <div className={""}>{optionJSON.title}</div>
        </div>
      ))}
    </div>
  );
}
