import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DownloadsPage from './pages/DownloadsPage';
import AccountPage from './pages/AccountPage';
import HelpPage from './pages/HelpPage';
import './App.css';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/downloads" element={<DownloadsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/auto-login" element={<AccountPage />} />
        <Route path="/help" element={<HelpPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
