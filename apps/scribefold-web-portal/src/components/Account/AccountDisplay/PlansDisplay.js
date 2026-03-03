import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../../../Global/SupabaseClient';
import { PLANS } from '../../../Global/constants';
import { formatTokens } from '../../../Global/functions';

const PlansDisplay = () => {
  const authUser = useSelector(state => state.userSlice.authUser);
  const userData = useSelector(state => state.userSlice.userData);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionStatusMsg, setSubscriptionStatusMsg] = useState('');

  // Get current plan from user's tier_id
  const currentPlan = PLANS.find(p => p.tier_id === Number(userData?.tier_id));

  // Reset loading state on mount (in case user returns from Stripe checkout)
  useEffect(() => {
    setSubscriptionLoading(false);
    setSubscriptionStatusMsg('');
  }, []);

  // Handle Stripe checkout for subscriptions using Checkout Sessions
  const handleSubscribeWithStripe = async () => {
    if (!authUser) return;

    const selectedPlan = PLANS.find((plan) => plan?.id === selectedPlanId);
    if (!selectedPlan) {
      setSubscriptionStatusMsg('Plan not found');
      return;
    }

    // Check if user is selecting their current plan
    const isCurrentPlan = selectedPlan && userData?.tier_id && Number(selectedPlan.tier_id) === Number(userData.tier_id);
    if (isCurrentPlan) {
      setSubscriptionStatusMsg('This is your current plan. No action needed.');
      return;
    }

    setSubscriptionLoading(true);
    setSubscriptionStatusMsg('Calling stripe to create checkout session...');

    try {
      // Get current session from Supabase client
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('[WEB] No valid session:', sessionError);
        setSubscriptionStatusMsg('No valid session');
        setSubscriptionLoading(false);
        return;
      }

      const accessToken = session.access_token;

      // Call the server to create a checkout session
      const response = await fetch(`${process.env.REACT_APP_API_URL}/s/create-checkout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          authId: authUser.id,
          planId: selectedPlanId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[WEB] Checkout error:', err);
      setSubscriptionStatusMsg(`Failed to redirect to checkout: ${err.message}`);
      setSubscriptionLoading(false);
    }
  };

  const getSubscribeButtonText = () => {
    if (subscriptionLoading) return 'Processing...';
    if (!selectedPlanId) return 'Choose A Plan';

    const selectedPlan = PLANS.find(p => p.id === selectedPlanId);
    const isCurrentPlan = selectedPlan && userData?.tier_id && Number(selectedPlan.tier_id) === Number(userData.tier_id);

    if (isCurrentPlan) return '(you have selected your current plan)';
    if (userData?.tier_id) return 'Change Plan';
    return 'Subscribe';
  };

  return (
    <section className="sf-plans-section">
      <div className="sf-plans-header sf-plans-header-center">
        <h2>Choose a Plan</h2>
      </div>
      <div className="sf-plans-grid">
        {PLANS.map((plan) => {
          const numericTokens = Number(plan?.tokens);
          const numericPrice = Number(plan?.monthlyPrice);
          const hasNumericTokens = Number.isFinite(numericTokens);
          const hasNumericPrice = Number.isFinite(numericPrice);
          const pricePerThousand =
            hasNumericTokens && hasNumericPrice && numericTokens > 0
              ? numericPrice / (numericTokens / 1000)
              : null;
          const isCurrentPlan = currentPlan?.id === plan.id;
          const isSelected = selectedPlanId === plan?.id;
          return (
            <button
              key={plan?.id}
              type="button"
              className={`sf-plan-card ${isSelected ? 'sf-plan-card-selected' : ''} ${isCurrentPlan ? 'sf-plan-card-current' : ''}`}
              onClick={() => setSelectedPlanId(plan?.id)}
            >
              <div className="sf-plan-header-row">
                <span className="sf-plan-name">
                  {plan?.name}
                </span>
              </div>
              {isCurrentPlan && (
                <div className="sf-plan-current-label">
                  (Your Plan)
                </div>
              )}
              <div className="sf-plan-body">
                <div className="sf-plan-tokens">
                  {hasNumericTokens
                    ? `${formatTokens(numericTokens)} tokens / month`
                    : 'Loading tokens...'}
                </div>
                <div className="sf-plan-price">
                  {hasNumericPrice ? `$${numericPrice}/mo` : 'Loading...'}
                </div>
                <div className="sf-plan-unit-price sf-plan-card-text-grey">
                  {pricePerThousand != null
                    ? `$${pricePerThousand.toFixed(3)} per 1k tokens`
                    : 'Loading...'}
                </div>
                <div className="sf-plan-description sf-plan-card-text-grey sf-plan-description-center">
                  {plan?.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="sf-plans-footer">
        <div className="sf-plans-buttons">
          <button 
            type="button" 
            className={`sf-primary-btn sf-plans-subscribe-btn ${(() => {
              const currentTierId = userData?.tier_id;
              const selectedPlan = PLANS.find(p => p.id === selectedPlanId);
              const selectedTierId = selectedPlan?.tier_id;
              return (selectedPlanId && (!currentTierId || selectedTierId > currentTierId)) ? 'sf-plans-subscribe-btn-glow' : '';
            })()}`}
            onClick={handleSubscribeWithStripe}
            disabled={!selectedPlanId || subscriptionLoading}
          >
            {getSubscribeButtonText()}
          </button>
          {subscriptionStatusMsg && (
            <div className="sf-plans-status-message">
              {subscriptionStatusMsg}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PlansDisplay;
