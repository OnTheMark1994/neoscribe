/*
  shows conditionally based on the redux windowSlice.showSettingsWindow

  selecte tab is local state
  it is set to windowSlice.settingsInitialTab by default (will be null if not set explicitly when opening the window)
  this determines which of the tabs show
 
  there is a top are saying settings
  there are tabs that can be selected in a bar
  based on which tab is selected the tabs corresponding component will show
  
  there sould be very little props and a very simplistic jsx 

*/
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Window from '../Util/Window';
import SettingsGeneral from './Tabs/SettingsGeneral';
import SettingsAI from './Tabs/SettingsAI';
import { closeSettingsWindow } from '../../Global/ReduxSlices/WindowSlice';

export default function SettingsWindow() {

  // Determines if the window shows by setting the open state of the Window component
  const showWindow = useSelector(state => state.windowSlice.showSettingsWindow)
  // Sets the initial tab (set to null in ation if string is not sent into open settings menu action call)
  const initialTab = useSelector(state => state.windowSlice.settingsInitialTab)
  // Determines what tab is selected, set primarily by tab onClick and default vaule can be set by settingsInitialTab that can be set by the button that opens the settings menu
  const [tab, setTab] = useState(initialTab)

  const dispatch = useDispatch()

  useEffect(() => {
    setTab(initialTab)
  }, [initialTab])

  // The data that deterines which tabs are available and how they display
  const tabs = [
    {
      title: "General",
      component: (<SettingsGeneral></SettingsGeneral>)
    },
    {
      title: "AI",
      component: (<SettingsAI></SettingsAI>)
    }
  ]

  return (
    // Conditional display window
    <Window
      title="Settings"
      onClose={() => dispatch(closeSettingsWindow())}
      open={showWindow}
    >
      {/* Top Area */}
      <div>
        {/* top area (maybe says Settings and has an image of the main scroll eye icon) */}
      </div>

      {/* Tabs */}
      <div className="settingsTab">
          {tabs.map(tabJSON => (
            <div 
              className={"settingsTab "+((tab === tabJSON.title)? "settingsTabSelected":"")}
              onClick={()=>setTab(tabJSON.title)}
            >
              {tabJSON.title}
            </div>
          ))}
      </div>

      {/* Section displat with the actual settings in it */}
      {tabs.map(tabJSON => (
        <div className="settingsTabContainer">
          {tab === tabJSON.title ? tabJSON.component : null}
        </div>
      ))}

    </Window>
  );
}
