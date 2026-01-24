import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppInitializer from './Global/AppInitializer';
import Home from './components/Home/Home';
import Downloads from './components/Downloads/Downloads';
import Help from './components/Help/Help';
import './MainDisplay.css';
import Account from './components/Account/Account';
import AutoLogin from './components/Account/AutoLogin/AutoLogin';
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
            <Route path="/confirm" element={<Confirm />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </>
  );
}

export default App;
