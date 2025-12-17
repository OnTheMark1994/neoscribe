/*
    This is opened with a little + button at the top right of the message component

    it shows all message data
    message that was sent and response
    raw json sent to the ai including all shared content
    raw response
    parsed response
    timestamps 
    etc

    all of this is stored in the message data that is stored in the state.aiSlice.messages array 
    corresponding data is sent into the message and menuSlice.messageDetailData is set to that json on click of the + button in the message

    the button that shows this menu is only visible in developer mode

*/
export default function MessageDetail() {

    const messageDetailData = useSelector(state => state.menu.messageDetailData)
    const dispatch = useDispatch()

    // If no messageDetailData this window does not show
    if(!messageDetailData) return

    return (
        <Window
            // Settings messageDetailData to null hides this window
            onClose={()=>dispatch(setMessageDetailData())}
        >
        
        </Window>
    );
}
