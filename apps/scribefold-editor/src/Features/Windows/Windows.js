import React from 'react';
import SettingsWindow from '../Settings/SettingsWindow';
import RightClickWindow from './RightClickWindow';
import SaveBeforeClosingWindow from './SaveBeforeClosingWindow';
import HelpWindow from './HelpWindow';
import AiChatMessageDetail from '../AI/ChatBar/AiChatMessageDetail';
import FileEncryptionWindow from './FileEncryptionWindow';
/*
    Contains conditional windows

    They all know from the redux state they retrieve internally if they should show 
    so this is a very simple comonent just containing others 

*/
export default function Windows({ monacoEditorRef }) {

  return (
    <>
      <SettingsWindow/>
      {/* <RightClickWindow/> */}
      <SaveBeforeClosingWindow/>
      <HelpWindow/>
      <AiChatMessageDetail/>
      <FileEncryptionWindow monacoEditorRef={monacoEditorRef}/>
    </>
  );
}
