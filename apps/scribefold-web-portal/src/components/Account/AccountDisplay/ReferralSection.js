import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import './ReferralSection.css';

const ReferralSection = () => {
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData);
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authUser?.id) {
      setReferralLink(`${window.location.origin}?ref=${authUser.id}`);
    }
  }, [authUser?.id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRequestPayment = () => {
    // TODO: Implement payment request logic
    console.log('Request payment clicked');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  return (
    <section className="sf-referral-section">
      <div className="sf-referral-header">
        <h2><span className="sf-referral-dollar">$</span> Referrals <span className="sf-referral-dollar">$</span></h2>
      </div>
      <div className="sf-referral-content">

        {/* Balance Box */}
        <div className="sf-referral-balance-box">
                
          <div className="sf-balance-display">
            <span className="sf-balance-label">Current balance</span>
            <span className="sf-balance-amount">
              {userData?.referral_balance ? formatCurrency(userData.referral_balance) : '$0.00'}
            </span>
          </div>
    <button
            onClick={handleRequestPayment}
            className="sf-request-payment-btn"
          >
            <span className="sf-request-payment-dollar">$</span> Request Payment <span className="sf-request-payment-dollar">$</span>
          </button>
       {/* Referral Link */}
        <div style={{width: "100%"}}>
          <label className="sf-referral-label">Your referral link</label>
          <div className="sf-referral-link-box">
            <input
              type="text"
              value={referralLink}
              readOnly
              className="sf-referral-input"
              placeholder="Loading referral link..."
            />
            <button
              onClick={handleCopy}
              className="sf-copy-btn"
              disabled={!referralLink}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        </div>
        
        {/* Description */}
        <div>
          <p className="sf-referral-description">
            <span className={"gold-text"}>
              Earn 25% of all subscription payments from users you refer.s
            </span>
          </p>
          <p className="sf-referral-description">
            For example: 1,000 referred users * average 10/month/user * 25% = 
              <span className={"gold-text"}>
                $2,500 per month paid to you.
              </span>
          </p>
          <p className="">
            You must have an active subscription at the time they sign up to receive the credit.
            Without an active subscription no data for your referral link can be recorded.
            The break even point where you begin to profit montly is when you have referred just 4 subscribers.  
          </p>
        </div>

   


   
      </div>
    </section>
  );
};

export default ReferralSection;
