import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppInitializer from './Global/AppInitializer';
import Home from './components/Home/Home';
import Downloads from './components/Downloads/Downloads';
import Help from './components/Help/Help';
import './MainDisplay.css';
import Account from './components/Account/Account';
import AutoLogin from './components/Account/AutoLogin/AutoLogin';
import AutoLoginPassword from './components/Account/AutoLoginPassword';
import AutoLoginJWT from './components/Account/AutoLoginJWT';
import AutoLoginMagicLink from './components/Account/AutoLoginMagicLink';
import AutoLoginMagicLinkEnc from './components/Account/AutoLoginMagicLinkEnc';
import ClaimTokensEncrypted from './components/Account/ClaimTokensEncrypted';
import Navbar from './components/Layout/Nav/Navbar';
import Footer from './components/Layout/Footer/Footer';
import Confirm from './components/Account/Confirm/Confirm';

function App() {
  return (
    <>
      <AppInitializer />
      <div className="sf-root">
        <Navbar />
        <main className="sf-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/downloads" element={<Downloads />} />
            <Route path="/account" element={<Account />} />
            <Route path="/help" element={<Help />} />
            <Route path="/auto-login" element={<AutoLogin />} />
            <Route path="/auto-login-password" element={<AutoLoginPassword />} />
            <Route path="/auto-login-jwt" element={<AutoLoginJWT />} />
            <Route path="/auto-login-magiclink" element={<AutoLoginMagicLink />} />
            <Route path="/auto-login-magiclink-enc" element={<AutoLoginMagicLinkEnc />} />
            <Route path="/claim-tokens-encrypted" element={<ClaimTokensEncrypted />} />
            <Route path="/confirm" element={<Confirm />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
