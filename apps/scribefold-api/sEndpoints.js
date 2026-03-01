const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

// Stripe client will be initialized in server.js and passed via middleware
let stripe = null;

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
router.post('/webhook', async (req, res) => {
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
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log('[STRIPE WEBHOOK] Signature verified successfully');
    } else {
      // For testing without webhook signature verification
      console.warn('[STRIPE WEBHOOK] WARNING: No webhook secret configured, parsing body directly');
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('[STRIPE WEBHOOK] ERROR: Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[STRIPE WEBHOOK] Event type:', event.type);
  console.log('[STRIPE WEBHOOK] Event ID:', event.id);
  console.log('[STRIPE WEBHOOK] Event created:', new Date(event.created * 1000).toISOString());

  try {
    switch (event.type) {
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
          console.log('[STRIPE WEBHOOK] Retrieving subscription details...');
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          console.log('[STRIPE WEBHOOK] Subscription ID:', subscription.id);
          console.log('[STRIPE WEBHOOK] Subscription status:', subscription.status);
          console.log('[STRIPE WEBHOOK] Subscription current_period_start:', subscription.current_period_start, '->', new Date(subscription.current_period_start * 1000).toISOString());
          console.log('[STRIPE WEBHOOK] Subscription current_period_end:', subscription.current_period_end, '->', new Date(subscription.current_period_end * 1000).toISOString());
          console.log('[STRIPE WEBHOOK] Subscription cancel_at_period_end:', subscription.cancel_at_period_end);
          console.log('[STRIPE WEBHOOK] Subscription items:', JSON.stringify(subscription.items.data.map(item => ({
            price_id: item.price.id,
            quantity: item.quantity
          })), null, 2));
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log(`\n--- SUBSCRIPTION ${event.type.toUpperCase()} ---`);
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
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('\n--- SUBSCRIPTION DELETED ---');
        console.log('[STRIPE WEBHOOK] Subscription ID:', subscription.id);
        console.log('[STRIPE WEBHOOK] Customer:', subscription.customer);
        console.log('[STRIPE WEBHOOK] Status:', subscription.status);
        console.log('[STRIPE WEBHOOK] Ended at:', subscription.ended_at, '->', new Date(subscription.ended_at * 1000).toISOString());
        break;
      }

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
        }
        break;
      }

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
