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
import SettingsDisplay from './Tabs/SettingsDisplay';
import SettingsAI from './Tabs/SettingsAI';
import SettingsAccount from './Tabs/SettingsAccount';
import SettingsDeveloper from './Tabs/SettingsDeveloper';
import { setShowSettingsWindow } from '../../Global/ReduxSlices/WindowSlice';
import "./SettingsWindow.css"

export default function SettingsWindow() {

  // Determines if the window shows by setting the open state of the Window component
  const showWindow = useSelector(state => state.windowSlice.showSettingsWindow)
  // Sets the initial tab (set to null in ation if string is not sent into open settings menu action call)
  const initialTab = useSelector(state => state.windowSlice.settingsInitialTab)
  // Determines what tab is selected, set primarily by tab onClick and default vaule can be set by settingsInitialTab that can be set by the button that opens the settings menu
  const [tab, setTab] = useState(initialTab ?? 'General')

  const dispatch = useDispatch()

  useEffect(() => {
    setTab(initialTab ?? 'General')
  }, [initialTab])

  // The data that deterines which tabs are available and how they display
  const tabs = {
    General: {
      title: "General",
      component: (<SettingsGeneral></SettingsGeneral>)
    },
    Display: {
      title: "Display",
      component: (<SettingsDisplay></SettingsDisplay>)
    },
    AI: {
      title: "AI",
      component: (<SettingsAI></SettingsAI>)
    },
    Account: {
      title: "Account",
      component: (<SettingsAccount></SettingsAccount>)
    },
    Developer: {
      title: "Developer",
      component: (<SettingsDeveloper></SettingsDeveloper>)
    },
  }
  

  return (
    // Conditional display window
    <Window
      title="Settings"
      onClose={() => dispatch(setShowSettingsWindow(false))}
      open={showWindow}
      className="settingsWindow"
    >
      <div className="settings-container">
        <div className="tabs-container">
          {Object.values(tabs).map(tabJSON => (
            <button
              key={tabJSON.title}
              type="button"
              className={`tab ${tab === tabJSON.title ? 'active' : ''}`}
              onClick={() => setTab(tabJSON.title)}
            >
              {tabJSON.title}
            </button>
          ))}
        </div>

        {/* Section display with the actual settings in it */}
        {tabs[tab]?.component}

      </div>

    </Window>
  );
}
