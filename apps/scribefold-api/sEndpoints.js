const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

// Stripe client will be initialized in server.js and passed via middleware
let stripe = null;

// Helper: Get plan by price_id
const getPlanByPriceId = (priceId) => PLANS.find(plan => plan.stripe_price_id === priceId);

// Helper: Get plan by tier_id
const getPlanByTierId = (tierId) => PLANS.find(plan => plan.tier_id === tierId);

// Helper: Update user subscription data
const updateUserSubscription = async (supabase, userId, subscriptionData) => {
  const { error } = await supabase
    .from('users')
    .update(subscriptionData)
    .eq('auth_id', userId);
  if (error) console.error('[STRIPE WEBHOOK] Failed to update subscription:', error);
};

// Helper: Add tokens based on subscription scenario
const addTokensForSubscription = async (supabase, userId, oldTierId, newTierId, isNewSubscription) => {
  const oldPlan = oldTierId ? getPlanByTierId(oldTierId) : null;
  const newPlan = newTierId ? getPlanByTierId(newTierId) : null;

  // If no new plan (cancelled subscription), don't add tokens
  if (!newPlan) {
    console.log('[STRIPE WEBHOOK] No new plan (cancelled subscription), not adding tokens');
    return;
  }

  let tokensToAdd = 0;

  if (isNewSubscription || !oldTierId) {
    // New subscription: Add all tokens
    tokensToAdd = newPlan.tokens;
    console.log('[STRIPE WEBHOOK] New subscription, adding tokens:', tokensToAdd);
  } else if (newPlan.tier_id > oldPlan.tier_id) {
    // Upgrade: Add the difference
    tokensToAdd = newPlan.tokens - oldPlan.tokens;
    console.log('[STRIPE WEBHOOK] Upgrade, adding tokens:', tokensToAdd);
  } else {
    // Downgrade: Don't add tokens
    console.log('[STRIPE WEBHOOK] Downgrade, not adding tokens');
  }

  if (tokensToAdd > 0) {
    const { error } = await supabase
      .from('users')
      .update({ tokens_monthly: newPlan.tokens })
      .eq('auth_id', userId);
    if (error) console.error('[STRIPE WEBHOOK] Failed to update tokens:', error);
  }
};

// Initialize Stripe client
router.use((req, res, next) => {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('✓ Stripe client initialized');
  }
  next();
});

/**
 * Stripe Webhook Handler - TEST VERSION
 * POST /s/webhook
 * Handles subscription lifecycle events with detailed logging
 */
router.post('/webhook', async (req, res, next) => {
  console.log('\n========================================');
  console.log('[STRIPE WEBHOOK] Incoming webhook request');
  console.log('========================================');

  if (!stripe) {
    console.error('[STRIPE WEBHOOK] ERROR: Stripe not configured');
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('[STRIPE WEBHOOK] Signature present:', !!sig);
  console.log('[STRIPE WEBHOOK] Webhook secret configured:', !!webhookSecret);

  let event;

  try {
    if (webhookSecret) {
      // Use raw body for signature verification
      const rawBody = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      console.log('[STRIPE WEBHOOK] Signature verified successfully');
    } else {
      // For testing without webhook signature verification
      console.warn('[STRIPE WEBHOOK] WARNING: No webhook secret configured, parsing body directly');
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[STRIPE WEBHOOK] ERROR: Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  console.log('[STRIPE WEBHOOK] Event type:', event.type);
  console.log('[STRIPE WEBHOOK] Event ID:', event.id);
  console.log('[STRIPE WEBHOOK] Event created:', new Date(event.created * 1000).toISOString());

  try {
    switch (event.type) {
      // ============================================================================
      // CHECKOUT SESSION COMPLETED
      // ============================================================================
      // TRIGGER: User completes Stripe checkout (first-time subscription or upgrade)
      // PURPOSE: Sets up new subscription with initial tokens
      // ACTIONS:
      //   - Updates tier_id, stripe_subscription_id, stripe_customer_id, subscription_status
      //   - Sets tokens_monthly to max(current, tierLimit) - tops up if user had less
      //   - Resets tokens_used_this_month to 0 (new billing period)
      // WHY THIS IS SOURCE OF TRUTH:
      //   - customer.subscription.created also fires but we skip it to avoid duplicate tokens
      //   - This webhook has authId in metadata, allowing us to identify the user
      // ============================================================================
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('\n--- CHECKOUT SESSION COMPLETED ---');
        console.log('[STRIPE WEBHOOK] Session ID:', session.id);
        console.log('[STRIPE WEBHOOK] Customer:', session.customer);
        console.log('[STRIPE WEBHOOK] Customer email:', session.customer_email);
        console.log('[STRIPE WEBHOOK] Subscription:', session.subscription);
        console.log('[STRIPE WEBHOOK] Client reference ID:', session.client_reference_id);
        console.log('[STRIPE WEBHOOK] Metadata:', JSON.stringify(session.metadata, null, 2));
        console.log('[STRIPE WEBHOOK] Amount total:', session.amount_total);
        console.log('[STRIPE WEBHOOK] Currency:', session.currency);
        console.log('[STRIPE WEBHOOK] Payment status:', session.payment_status);
        console.log('[STRIPE WEBHOOK] Mode:', session.mode);

        if (session.subscription) {
          const authId = session.metadata?.authId;
          if (!authId) {
            console.error('[STRIPE WEBHOOK] ERROR: No authId in metadata');
            break;
          }

          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = subscription.items.data[0]?.price?.id;
          const plan = getPlanByPriceId(priceId);

          if (!plan) {
            console.error('[STRIPE WEBHOOK] ERROR: Plan not found for price_id:', priceId);
            break;
          }

          // Get current user data
          const { data: user } = await req.supabaseAdmin
            .from('users')
            .select('*')
            .eq('auth_id', authId)
            .single();

          if (!user) {
            console.error('[STRIPE WEBHOOK] ERROR: User not found');
            break;
          }

          // Update subscription data
          await updateUserSubscription(req.supabaseAdmin, authId, {
            tier_id: plan.tier_id,
            subscription_tier_name: plan.name,
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: session.customer,
            next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
          });

          // Set tokens_monthly to tier limit, reset tokens_used to 0
          // Per TOKEN_TRACKING.md Section 3.1
          const currentMonthly = user.tokens_monthly || 0;
          const tierLimit = plan.tokens;
          const newMonthly = Math.max(currentMonthly, tierLimit);

          await req.supabaseAdmin
            .from('users')
            .update({
              tokens_monthly: newMonthly,
              tokens_used_this_month: 0,
            })
            .eq('auth_id', authId);

          console.log('[STRIPE WEBHOOK] New subscription: tokens_monthly set to', newMonthly, ', tokens_used reset to 0');
          console.log('[STRIPE WEBHOOK] User subscription updated successfully');
        }
        break;
      }

      // ============================================================================
      // CUSTOMER SUBSCRIPTION UPDATED
      // ============================================================================
      // TRIGGER: Plan changes (upgrade/downgrade) or customer updates subscription
      // PURPOSE: Handles metadata updates only - NO token changes here
      // ACTIONS:
      //   - Updates tier_id, stripe_subscription_id, subscription_status
      //   - For upgrades/downgrades: only updates metadata (tier_id, status)
      //   - NO token changes - checkout.session.completed handles all token updates
      // WHY THIS IS SOURCE OF TRUTH:
      //   - checkout.session.completed handles all token updates (new subscriptions AND upgrades)
      //   - This webhook only updates metadata to avoid duplicate token grants
      // ============================================================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('\n--- SUBSCRIPTION UPDATED ---');
        console.log('[STRIPE WEBHOOK] Subscription ID:', subscription.id);
        console.log('[STRIPE WEBHOOK] Customer:', subscription.customer);
        console.log('[STRIPE WEBHOOK] Status:', subscription.status);
        console.log('[STRIPE WEBHOOK] Current period start:', subscription.current_period_start, '->', new Date(subscription.current_period_start * 1000).toISOString());
        console.log('[STRIPE WEBHOOK] Current period end:', subscription.current_period_end, '->', new Date(subscription.current_period_end * 1000).toISOString());
        console.log('[STRIPE WEBHOOK] Cancel at period end:', subscription.cancel_at_period_end);
        console.log('[STRIPE WEBHOOK] Items:', JSON.stringify(subscription.items.data.map(item => ({
          price_id: item.price.id,
          price_amount: item.price.unit_amount / 100,
          quantity: item.quantity
        })), null, 2));

        if (subscription.schedule) {
          console.log('[STRIPE WEBHOOK] Scheduled changes:', JSON.stringify(subscription.schedule, null, 2));
        }

        // Get plan from subscription items
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = getPlanByPriceId(priceId);

        if (!plan) {
          console.error('[STRIPE WEBHOOK] ERROR: Plan not found for price_id:', priceId);
          break;
        }

        // Get user by stripe_customer_id
        const { data: users } = await req.supabaseAdmin
          .from('users')
          .select('*')
          .eq('stripe_customer_id', subscription.customer);

        if (!users || users.length === 0) {
          console.error('[STRIPE WEBHOOK] ERROR: User not found for customer:', subscription.customer);
          break;
        }

        const user = users[0];

        // Update subscription metadata only (NO token changes)
        await updateUserSubscription(req.supabaseAdmin, user.auth_id, {
          tier_id: plan.tier_id,
          subscription_tier_name: plan.name,
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id,
          next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
        });

        // NOTE: checkout.session.completed handles all token updates (new subscriptions AND upgrades)
        // This webhook only updates metadata to avoid duplicate token grants
        console.log('[STRIPE WEBHOOK] Metadata updated, no token changes (checkout.session.completed handles tokens)');

        console.log('[STRIPE WEBHOOK] User subscription updated successfully');
        break;
      }

      // ============================================================================
      // CUSTOMER SUBSCRIPTION DELETED
      // ============================================================================
      // TRIGGER: User cancels subscription
      // PURPOSE: Handles subscription cancellation
      // ACTIONS:
      //   - Sets tier_id to null, subscription_status to 'canceled'
      //   - Sets tokens_monthly to 0 (no more monthly allowance)
      //   - Preserves tokens_added (user keeps bonus/purchased tokens)
      // WHY THIS IS SOURCE OF TRUTH:
      //   - Only webhook that fires on cancellation
      // ============================================================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('\n--- SUBSCRIPTION DELETED ---');
        console.log('[STRIPE WEBHOOK] Subscription ID:', subscription.id);
        console.log('[STRIPE WEBHOOK] Customer:', subscription.customer);
        console.log('[STRIPE WEBHOOK] Status:', subscription.status);
        console.log('[STRIPE WEBHOOK] Ended at:', subscription.ended_at, '->', new Date(subscription.ended_at * 1000).toISOString());

        // Get user by stripe_customer_id
        const { data: users } = await req.supabaseAdmin
          .from('users')
          .select('*')
          .eq('stripe_customer_id', subscription.customer);

        if (!users || users.length === 0) {
          console.error('[STRIPE WEBHOOK] ERROR: User not found for customer:', subscription.customer);
          break;
        }

        const user = users[0];

        // Update subscription status (don't change tokens)
        await updateUserSubscription(req.supabaseAdmin, user.auth_id, {
          tier_id: null,
          subscription_status: 'canceled',
          next_billing_date: null,
          tokens_monthly: 0,
        });

        console.log('[STRIPE WEBHOOK] Subscription cancelled, tokens_monthly set to 0, tokens_added preserved');
        break;
      }

      // ============================================================================
      // INVOICE PAYMENT SUCCEEDED
      // ============================================================================
      // TRIGGER: Monthly payment succeeds (renewal)
      // PURPOSE: Handles monthly renewal - tops up tokens and resets usage counters
      // ACTIONS:
      //   - Tops up tokens_monthly to tier limit (max(current, tierLimit))
      //   - Resets tokens_used_this_month to 0 (new billing period)
      //   - Updates next_billing_date
      // WHY THIS IS SOURCE OF TRUTH:
      //   - customer.subscription.updated also fires on renewals but we skip token updates there
      //   - This webhook handles the monthly renewal logic
      // ============================================================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        console.log('\n--- INVOICE PAYMENT SUCCEEDED ---');
        console.log('[STRIPE WEBHOOK] Invoice ID:', invoice.id);
        console.log('[STRIPE WEBHOOK] Customer:', invoice.customer);
        console.log('[STRIPE WEBHOOK] Subscription:', invoice.subscription);
        console.log('[STRIPE WEBHOOK] Amount paid:', invoice.amount_paid);
        console.log('[STRIPE WEBHOOK] Currency:', invoice.currency);
        console.log('[STRIPE WEBHOOK] Status:', invoice.status);
        console.log('[STRIPE WEBHOOK] Period start:', invoice.period_start, '->', new Date(invoice.period_start * 1000).toISOString());
        console.log('[STRIPE WEBHOOK] Period end:', invoice.period_end, '->', new Date(invoice.period_end * 1000).toISOString());

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          console.log('[STRIPE WEBHOOK] Subscription status:', subscription.status);
          console.log('[STRIPE WEBHOOK] Subscription current_period_end:', subscription.current_period_end, '->', new Date(subscription.current_period_end * 1000).toISOString());

          // Get user by stripe_customer_id
          const { data: users } = await req.supabaseAdmin
            .from('users')
            .select('*')
            .eq('stripe_customer_id', invoice.customer);

          if (!users || users.length === 0) {
            console.error('[STRIPE WEBHOOK] ERROR: User not found for customer:', invoice.customer);
            break;
          }

          const user = users[0];

          // Get plan from tier_id
          const plan = getPlanByTierId(user.tier_id);
          if (!plan) {
            console.error('[STRIPE WEBHOOK] ERROR: Plan not found for tier_id:', user.tier_id);
            break;
          }

          // Update next billing date
          await updateUserSubscription(req.supabaseAdmin, user.auth_id, {
            next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
          });

          // Top up tokens_monthly to tier limit, reset tokens_used to 0
          // Per TOKEN_TRACKING.md Section 3.2
          const currentMonthly = user.tokens_monthly || 0;
          const tierLimit = plan.tokens;
          const newMonthly = Math.max(currentMonthly, tierLimit);

          await req.supabaseAdmin
            .from('users')
            .update({
              tokens_monthly: newMonthly,
              tokens_used_this_month: 0,
            })
            .eq('auth_id', user.auth_id);

          console.log('[STRIPE WEBHOOK] Monthly renewal: tokens_monthly topped up to', newMonthly, ', tokens_used reset to 0');
        }
        break;
      }

      // ============================================================================
      // INVOICE PAYMENT FAILED
      // ============================================================================
      // TRIGGER: Monthly payment fails
      // PURPOSE: Handles payment failure - updates status but doesn't change tokens
      // ACTIONS:
      //   - Sets subscription_status to 'past_due'
      //   - No token changes (user keeps existing tokens until payment succeeds)
      // WHY THIS IS SOURCE OF TRUTH:
      //   - Only webhook that fires on payment failure
      // ============================================================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('\n--- INVOICE PAYMENT FAILED ---');
        console.log('[STRIPE WEBHOOK] Invoice ID:', invoice.id);
        console.log('[STRIPE WEBHOOK] Customer:', invoice.customer);
        console.log('[STRIPE WEBHOOK] Subscription:', invoice.subscription);
        console.log('[STRIPE WEBHOOK] Amount due:', invoice.amount_due);
        console.log('[STRIPE WEBHOOK] Currency:', invoice.currency);
        console.log('[STRIPE WEBHOOK] Status:', invoice.status);
        console.log('[STRIPE WEBHOOK] Reason:', invoice.last_payment_failure?.message || 'Unknown');

        if (invoice.subscription) {
          // Get user by stripe_customer_id
          const { data: users } = await req.supabaseAdmin
            .from('users')
            .select('*')
            .eq('stripe_customer_id', invoice.customer);

          if (!users || users.length === 0) {
            console.error('[STRIPE WEBHOOK] ERROR: User not found for customer:', invoice.customer);
            break;
          }

          const user = users[0];

          // Update subscription status (don't change tokens)
          await updateUserSubscription(req.supabaseAdmin, user.auth_id, {
            subscription_status: 'past_due',
          });

          console.log('[STRIPE WEBHOOK] Payment failed: subscription_status set to past_due, tokens unchanged');
        }
        break;
      }

      default:
        console.log('[STRIPE WEBHOOK] Unhandled event type:', event.type);
    }

    console.log('[STRIPE WEBHOOK] Webhook processed successfully');
    console.log('========================================\n');
    res.json({ received: true });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] ERROR processing event:', error);
    console.error('[STRIPE WEBHOOK] Error stack:', error.stack);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

module.exports = router;
