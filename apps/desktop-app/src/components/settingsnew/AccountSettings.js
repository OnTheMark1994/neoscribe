import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import '../Settings/Settings.css';
import RefreshButton from '../UI/RefreshButton';
import TokenUsageLog from '../Settings/TokenUsageLog';
import AccountAuthSection from '../Settings/AccountAuthSection';
import { devBurnTokens } from '../../utils/aiService';
import {
  selectAnonId,
  selectAuthUser,
  selectUserData,
  selectUserLoading,
  selectUserError,
  bumpUserReload,
} from '../../store/userSlice';
import { selectDeveloperMode } from '../../store/settingsSlice';

// WHAT: Account tab for auth + subscription + token usage.
// WHY HERE: Keeps all account logic together, reading anonId/authUser from Redux.
function AccountSettings({ activeTab }) {
  const dispatch = useDispatch();

  const containerClass = activeTab === 'account' ? 'tab-content active' : 'tab-content';

  return (
    <div className={containerClass}>
      <div className="setting-section">
        <div className="setting-section-header">
          <h2>Authentication & Subscription</h2>
          <RefreshButton
            onClick={() => dispatch(bumpUserReload())}
            disabled={!anonId}
            loading={accountLoading}
            title="Refresh account from server"
          />
        </div>

        <AccountAuthSection/>

        {/* Show the current ids for debugging when in developer mode */}
        {developerMode && (
          <>
            <div className="stat-item anon-id-box" style={{ marginTop: '12px' }}>
              <span className="stat-label">🔑 Anonymous ID</span>
              <span className="stat-value">{anonId || 'Loading...'}</span>
            </div>

            <div className="stat-item auth-id-box">
              <span className="stat-label">👤 Auth ID</span>
              <span className="stat-value">{authUser && authUser.id ? authUser.id : 'Not logged in'}</span>
            </div>
          </>
        )}
      </div>

      <div className="setting-section">
        <div className="setting-section-header">
          <h2>Token Usage</h2>
          <RefreshButton
            onClick={() => dispatch(bumpUserReload())}
            loading={accountLoading}
            title="Refresh token usage from server"
          />
        </div>
        <div className="stat-item">
          <span className="stat-label">Tokens Remaining This Month</span>
          <span className="stat-value token-count">{availableTokens.toLocaleString()}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Monthly Balance</span>
          <span className="stat-value">
            {tokensMonthly != null ? tokensMonthly.toLocaleString() : 'Loading...'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tokens Used This Month</span>
          <span className="stat-value">
            {tokensUsed != null ? tokensUsed.toLocaleString() : 'Loading...'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tokens Added</span>
          <span className="stat-value">
            {tokensAdded != null ? tokensAdded.toLocaleString() : 'Loading...'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tokens Used All Time</span>
          <span className="stat-value">
            {tokensUsedAllTime != null ? tokensUsedAllTime.toLocaleString() : 'Loading...'}
          </span>
        </div>

        <TokenUsageLog anonId={anonId} authId={authUser ? authUser.id : null} />
      </div>

      {accountError && (
        <div className="setting-section">
          <h2>Account Load Error</h2>
          <div className="stat-item">
            <span className="stat-label">Error</span>
            <span className="stat-value">{accountError}</span>
          </div>
        </div>
      )}

      {developerMode && (
        <div className="setting-section">
          <div className="setting-section-header">
            <h2>Developer Tools</h2>
            <RefreshButton
              onClick={() => dispatch(bumpUserReload())}
              disabled={!anonId}
              loading={accountLoading}
              title="Refresh developer data from server"
            />
          </div>

          {developerToolsStatus && (
            <div className="stat-item">
              <span className="stat-label">{developerToolsStatus}</span>
            </div>
          )}

          <div className="stat-item" style={{ justifyContent: 'center', gap: '10px' }}>
            <button type="button" className="btn-secondary" onClick={handleDeveloperResetIds}>
              Reset local anon/auth IDs
            </button>
            <button type="button" className="btn-secondary" onClick={handleDeveloperBurnTokens}>
              -14k tokens
            </button>
          </div>

          {userData && (
            <div className="stat-item">
              <span className="stat-label">Raw User Record</span>
              <pre className="user-account-json">{JSON.stringify(userData, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AccountSettings;
