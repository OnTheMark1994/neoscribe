/*
  This component shows to the left of the window when the mode is active

  It shows a bar on the left that is height 100% and width of a set amount like 300px

  there is a top section with a title and icon
  a row showing token info like how many tokens the user has, a refresh button, 
  how many each call will take, and an info button showing the help menu going right too the correct section with the dispatched action
  
  there is a messages area with all of the messages from the user and ai assistant

  and there is an input area with a send button at the bottom
 
  the message chain, proposed changes array, and all other related state are in the aiSlice

  the refresh button connects to a function in the initializer
    the button shows its "refreshing" or not state (changes css display) based on the redux loading user data value
    it calls an action that triggers the user data reload when pressed
    this makes all refresh buttons in sync all over the app
    the refresh button component is used for this 

  Uses custom chat api that takes params
    model to use (if left blank uses default one, just use default for now we will add this functionality later)
    all ids (auth, device, anon)
    messages so far
    the api generates a new message and sends it back, 
    sends proposed changes in the text which is parsed and put in redux aiSlice, 
    changes the users tokens by connecting to the database from the server 
    sends new token values so we can update user data withouth needing to refresh user data in a seperate call
      (can call userSlice action specifically for this)
    
    so on response
      new message shows in the messages area
      then the proposed changes will show in the editor
      new token value shows in the chat area (and the settings if the user goes there) becasue user data is updated
      all data is saved into the messages array in aislice so a developer can open thenm for inspection

 */
import { useSelector } from 'react-redux';
import './AiChatBar.css';
export default function AiChatBar() {

  // Get redux state that determines if it shows
  const showChatBar = useSelector(state => state.aiSlice.aiModeActive)

  // Return if show state is false (if ai mode is off)
  if(!showChatBar) return null

  return (
    <div className="aiChatBar">
      <div className="aiChatBarHeader">
        <div className="aiChatBarTitle">AI Chat</div>
      </div>
    </div>
  );
}
