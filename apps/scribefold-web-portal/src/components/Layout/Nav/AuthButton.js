import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { setShowAuthWindow } from '../../../Global/ReduxSlices/UserSlice';

export default function AuthButton() {
  const authUser = useSelector(state => state.userSlice.authUser);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (authUser) {
      navigate('/account');
    } else {
      e.preventDefault();
      // Show auth window
      dispatch(setShowAuthWindow(true));
    }
  };

  return (
    <NavLink 
      to={authUser ? '/account' : '#'} 
      className="sf-auth-button sf-auth-button-outline"
      onClick={handleClick}
    >
      {authUser ? 'View Account' : 'Log In / Sign Up'}
    </NavLink>
  );
}
