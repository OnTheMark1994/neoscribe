import { useSelector } from "react-redux";
import { formatTokens } from "../../../Global/functions";
import RefreshUserData from "../../Util/RefreshUserData";

export default function TokensDisplay() {

  const userData = useSelector(state => state.userSlice.userData);
  const userDataLoading = useSelector(state => state.userSlice.userDataLoading);

  return (
        <section className="sf-account-stats">
          <div className="sf-section-header">
            <h2>Token Usage</h2>
            <RefreshUserData />
          </div>
          <div className="sf-stats-grid">
            <div className="sf-stat-card">
              <span className="sf-stat-label">Available Tokens</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData?.tokens || (userData?.tokens_monthly || 0) + (userData?.tokens_added || 0))}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Used This Month</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData?.tokens_used_this_month)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Monthly Tokens Remaining</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData?.tokens_monthly)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Added Tokens Remaining</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData?.tokens_added)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Used All Time</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData?.tokens_used_all_time)}
              </span>
            </div>
            <div className="sf-stat-card">
              <span className="sf-stat-label">Tokens Added Monthly</span>
              <span className="sf-stat-value">
                {userDataLoading
                  ? 'Loading...'
                  : formatTokens(userData?.tokens_monthly)}
              </span>
            </div>
          </div>
        </section>
    )
}
