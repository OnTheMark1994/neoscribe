const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const { PLANS } = require('./constants');

// Stripe client will be initialized in server.js and passed via middleware
let stripe = null;

// Helper: Get plan by price_id
const getPlanByPriceId = (priceId) => Object.values(PLANS).find(plan => plan.stripe_price_id === priceId);

// Helper: Get plan by tier_id
const getPlanByTierId = (tierId) => Object.values(PLANS).find(plan => plan.tier_id === tierId);

// Helper: Get plan by id
const getPlanById = (planId) => PLANS[planId];

// Helper: Update user subscription data
const updateUserSubscription = async (supabase, userId, subscriptionData) => {
  const { error } = await supabase
    .from('users')
    .update(subscriptionData)
    .eq('auth_id', userId);
  if (error) console.error('[STRIPE WEBHOOK] Failed to update subscription:', error);
};

/**
 * Create Stripe Customer Portal Session
 * POST /s/create-portal-session
 * Body: { authId }
 */
router.post('/create-portal-session', async (req, res) => {
  console.log('\n========================================');
  console.log('[STRIPE PORTAL] Creating portal session');
  console.log('========================================');

  try {
    const { authId } = req.body;

    if (!authId) {
      console.error('[STRIPE PORTAL] ERROR: No authId provided');
      return res.status(400).json({ error: 'No authId provided' });
    }

    console.log('[STRIPE PORTAL] authId:', authId);

    // Verify JWT token and extract user ID
    const userAccessToken = req.headers.authorization?.replace('Bearer ', '');
    if (!userAccessToken) {
      console.error('[STRIPE PORTAL] ERROR: No access token provided');
      return res.status(401).json({ error: 'No access token provided' });
    }

    let decoded;
    try {
      decoded = jwt.verify(userAccessToken, process.env.SUPABASE_JWT_SECRET);
      console.log('[STRIPE PORTAL] JWT verified successfully, user ID:', decoded?.sub);
    } catch (e) {
      console.error('[STRIPE PORTAL] ERROR: JWT verification failed:', e.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = decoded?.sub;
    if (!userId) {
      console.error('[STRIPE PORTAL] ERROR: No user ID in decoded token');
      return res.status(401).json({ error: 'Invalid token: no user ID found' });
    }

    // Ensure authId matches the authenticated user
    if (authId !== userId) {
      console.error('[STRIPE PORTAL] ERROR: authId does not match authenticated user');
      return res.status(403).json({ error: 'Forbidden: authId does not match authenticated user' });
    }

    // Get user by authId
    const { data: users } = await req.supabaseAdmin
      .from('users')
      .select('stripe_customer_id')
      .eq('auth_id', authId);

    if (!users || users.length === 0) {
      console.error('[STRIPE PORTAL] ERROR: User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    const customerId = user.stripe_customer_id;

    if (!customerId) {
      console.error('[STRIPE PORTAL] ERROR: No stripe_customer_id for user');
      return res.status(400).json({ error: 'No stripe_customer_id found' });
    }

    console.log('[STRIPE PORTAL] Customer ID:', customerId);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.WEB_PORTAL_URL || 'https://scribefold-ai-monorepo.onrender.com/',
    });

    console.log('[STRIPE PORTAL] Portal session created:', session.id);
    console.log('[STRIPE PORTAL] Portal URL:', session.url);

    res.json({ url: session.url });
  } catch (error) {
    console.error('[STRIPE PORTAL] ERROR:', error);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

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

  // console.log('[STRIPE WEBHOOK] Signature present:', !!sig);
  // console.log('[STRIPE WEBHOOK] Webhook secret configured:', !!webhookSecret);

  let event;

  try {
    if (webhookSecret) {
      // Use raw body for signature verification
      const rawBody = req.rawBody || req.body;
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      // console.log('[STRIPE WEBHOOK] Signature verified successfully');
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
  // console.log('[STRIPE WEBHOOK] Event ID:', event.id);
  // console.log('[STRIPE WEBHOOK] Event created:', new Date(event.created * 1000).toISOString());
  console.log('========================================');

  try {
    switch (event.type) {
      // ============================================================================
      // CHECKOUT SESSION COMPLETED
      // ============================================================================
      // TRIGGER: User completes checkout for a new subscription
      // PURPOSE: Cancel old subscription when user changes plans
      // ACTIONS:
      //   - Checks if user has existing active subscription
      //   - Cancels old subscription to prevent double billing
      // WHY THIS IS SOURCE OF TRUTH:
      //   - Only webhook that fires when checkout is completed
      //   - Ensures only one active subscription per customer
      // ============================================================================
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[STRIPE WEBHOOK] checkout.session.completed - Session ID:', session.id, 'Customer:', session.customer);

        if (!session.customer) {
          console.error('[STRIPE WEBHOOK] ERROR: No customer in checkout session');
          break;
        }

        // Get all subscriptions for this customer
        const subscriptions = await stripe.subscriptions.list({
          customer: session.customer,
          status: 'active',
        });

        console.log('[STRIPE WEBHOOK] Found', subscriptions.data.length, 'active subscription(s) for customer:', session.customer);
        subscriptions.data.forEach((sub, index) => {
          console.log(`[STRIPE WEBHOOK]   Subscription ${index + 1}: ID=${sub.id}, Created=${sub.created}, Status=${sub.status}`);
        });

        if (subscriptions.data.length > 1) {
          // User has multiple active subscriptions - cancel all except the newest one
          const sortedSubscriptions = subscriptions.data.sort((a, b) => b.created - a.created);
          const newSubscription = sortedSubscriptions[0];
          const oldSubscriptions = sortedSubscriptions.slice(1);

          console.log('[STRIPE WEBHOOK] Keeping newest subscription:', newSubscription.id, '(created:', newSubscription.created + ')');
          console.log('[STRIPE WEBHOOK] Cancelling', oldSubscriptions.length, 'old subscription(s)...');

          for (const oldSubscription of oldSubscriptions) {
            console.log('[STRIPE WEBHOOK]   Cancelling subscription:', oldSubscription.id, '(created:', oldSubscription.created + ')');
            await stripe.subscriptions.cancel(oldSubscription.id);
            console.log('[STRIPE WEBHOOK]   Successfully cancelled subscription:', oldSubscription.id);
          }
        }

        console.log('[STRIPE WEBHOOK] Checkout session completed successfully');
        break;
      }

      // ============================================================================
      // CUSTOMER SUBSCRIPTION UPDATED
      // ============================================================================
      // TRIGGER: Plan changes (new subscription, upgrade, downgrade)
      // PURPOSE: Handles ALL tier_id changes - single source of truth for subscription metadata
      // ACTIONS:
      //   - Updates tier_id, subscription_status, stripe_subscription_id
      //   - NO token changes - invoice.payment_succeeded handles tokens
      // WHY THIS IS SOURCE OF TRUTH:
      //   - Fires on new subscription, upgrade, downgrade
      //   - stripe_customer_id always available (created in checkout before payment)
      //   - Consolidates all tier_id changes in one place to avoid duplication
      // ============================================================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('[STRIPE WEBHOOK] customer.subscription.updated - Subscription ID:', subscription.id, 'Customer:', subscription.customer);

        // Get plan from subscription items
        const priceId = subscription.items.data[0]?.price?.id;
        console.log('[STRIPE WEBHOOK] priceId from subscription:', priceId);

        const plan = getPlanByPriceId(priceId);
        console.log('[STRIPE WEBHOOK] Found plan:', plan ? plan.name : 'null');

        if (!plan) {
          console.error('[STRIPE WEBHOOK] ERROR: Plan not found for price_id:', priceId);
          console.error('[STRIPE WEBHOOK] Available price IDs:', Object.values(PLANS).map(p => p.stripe_price_id));
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

        // Update subscription metadata (tier_id, status, subscription_id)
        await updateUserSubscription(req.supabaseAdmin, user.auth_id, {
          tier_id: plan.tier_id,
          subscription_status: subscription.status,
          stripe_subscription_id: subscription.id,
        });
        console.log('[STRIPE WEBHOOK] Setting tier_id to', plan.tier_id, '(', plan.name, '), subscription_status to', subscription.status);

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
        console.log('[STRIPE WEBHOOK] customer.subscription.deleted - Subscription ID:', subscription.id, 'Customer:', subscription.customer);

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

        // Check if user has any other active subscriptions (plan change scenario)
        const activeSubscriptions = await stripe.subscriptions.list({
          customer: subscription.customer,
          status: 'active',
        });

        if (activeSubscriptions.data.length > 0) {
          console.log('[STRIPE WEBHOOK] User has', activeSubscriptions.data.length, 'other active subscription(s) - skipping tier_id nullification (plan change)');
          console.log('[STRIPE WEBHOOK] Active subscription IDs:', activeSubscriptions.data.map(s => s.id).join(', '));
          break;
        }

        // No other active subscriptions - true cancellation
        console.log('[STRIPE WEBHOOK] No other active subscriptions - treating as true cancellation');
        await updateUserSubscription(req.supabaseAdmin, user.auth_id, {
          tier_id: null,
          subscription_status: 'canceled',
          tokens_monthly: 0,
        });
        console.log('[STRIPE WEBHOOK] Setting tier_id to null, subscription_status to canceled, tokens_monthly to 0');
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
        console.log('[STRIPE WEBHOOK] invoice.payment_succeeded - Invoice ID:', invoice.id, 'Customer:', invoice.customer);
        console.log('[STRIPE WEBHOOK] Has subscription:', !!invoice.subscription);

        // Always get all subscriptions for the customer and use the most recent one
        // This handles cases where invoice.subscription is missing or there are multiple subscriptions
        console.log('[STRIPE WEBHOOK] Getting all subscriptions for customer...');
        const subscriptions = await stripe.subscriptions.list({
          customer: invoice.customer,
          status: 'active',
        });

        console.log('[STRIPE WEBHOOK] Found', subscriptions.data.length, 'active subscription(s) for customer');
        subscriptions.data.forEach((sub, index) => {
          console.log(`[STRIPE WEBHOOK]   Subscription ${index + 1}: ID=${sub.id}, Created=${sub.created}, Status=${sub.status}`);
        });

        if (subscriptions.data.length === 0) {
          console.error('[STRIPE WEBHOOK] ERROR: No active subscriptions found for customer');
          break;
        }

        // Use the most recent subscription
        const sortedSubscriptions = subscriptions.data.sort((a, b) => b.created - a.created);
        const subscription = sortedSubscriptions[0];
        console.log('[STRIPE WEBHOOK] Using most recent subscription:', subscription.id, '(created:', subscription.created + ')');

        // Get price_id from subscription items
        const priceId = subscription.items.data[0]?.price?.id;
        console.log('[STRIPE WEBHOOK] priceId from subscription:', priceId);

        const plan = getPlanByPriceId(priceId);
        console.log('[STRIPE WEBHOOK] Found plan:', plan ? plan.name : 'null');

        if (!plan) {
          console.error('[STRIPE WEBHOOK] ERROR: Plan not found for price_id:', priceId);
          console.error('[STRIPE WEBHOOK] Available price IDs:', Object.values(PLANS).map(p => p.stripe_price_id));
          break;
        }

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

        // ADD tokens from the paid plan's tier (user paid, they get the tokens)
        const tierLimit = plan.tokens;
        const currentMonthly = user.tokens_monthly || 0;
        const newMonthly = currentMonthly + tierLimit;

        await req.supabaseAdmin
          .from('users')
          .update({
            tokens_monthly: newMonthly,
            tokens_used_this_month: 0,
          })
          .eq('auth_id', user.auth_id);
        console.log('[STRIPE WEBHOOK] Payment succeeded: Adding', tierLimit, 'tokens for plan', plan.name, '- Setting tokens_monthly to', newMonthly, ', tokens_used_this_month to 0');
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
        console.log('[STRIPE WEBHOOK] invoice.payment_failed - Invoice ID:', invoice.id, 'Customer:', invoice.customer);

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
          console.log('[STRIPE WEBHOOK] Setting subscription_status to past_due, no token changes');
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
