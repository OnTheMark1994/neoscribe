import React from 'react'

function UserDataRefreshButton() {
  
    const dispatch = useDispatch()
    // get userDataLoading from user data slice
  
    return (
        <div>
            <RefreshButton
            // onClick = {dispatch(reloadUserData())}
            // loading = {userDataLoading}
            title={"Reload User Data"}
            ></RefreshButton>
        </div>
    )
}

export default UserDataRefreshButton