import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { triggerReloadUserData } from '../../Global/ReduxSlices/UserSlice';
import RefreshButton from './RefreshButton';

export default function RefreshUserData() {
  const dispatch = useDispatch();
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);

  return (
    <RefreshButton
      loading={userDataLoading}
      title="Refresh account data"
      onClick={() => dispatch(triggerReloadUserData())}
    />
  );
}
