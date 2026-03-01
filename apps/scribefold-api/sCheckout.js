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
 * Create Stripe Checkout Session
 * POST /s/create-checkout
 * Body: { authId, priceId }
 */
router.post('/create-checkout', async (req, res) => {
  console.log('\n========================================');
  console.log('[STRIPE CHECKOUT] Creating checkout session');
  console.log('========================================');
  
  try {
    const { authId, priceId } = req.body;

    if (!stripe) {
      console.error('[STRIPE CHECKOUT] ERROR: Stripe not configured');
      return res.status(503).json({ error: 'Stripe not configured' });
    }

    if (!authId) {
      console.error('[STRIPE CHECKOUT] ERROR: authId is required');
      return res.status(400).json({ error: 'authId is required' });
    }

    if (!priceId) {
      console.error('[STRIPE CHECKOUT] ERROR: priceId is required');
      return res.status(400).json({ error: 'priceId is required' });
    }

    console.log('[STRIPE CHECKOUT] authId:', authId);
    console.log('[STRIPE CHECKOUT] priceId:', priceId);

    // Get user from database
    const { data: users, error: userError } = await req.supabaseAdmin
      .from('users')
      .select('id, stripe_customer_id')
      .eq('auth_id', authId);

    if (userError || !users || users.length === 0) {
      console.error('[STRIPE CHECKOUT] User not found:', userError);
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];

    // Get user email from Supabase auth (needed for Stripe customer creation)
    const { data: { user: authUser }, error: authError } = await req.supabaseAdmin.auth.admin.getUserById(authId);

    if (authError || !authUser) {
      console.error('[STRIPE CHECKOUT] ERROR: Failed to get user from auth:', authError);
      return res.status(404).json({ error: 'User not found in auth' });
    }

    const userEmail = authUser.email;

    let customerId = user.stripe_customer_id;

    console.log('[STRIPE CHECKOUT] User found:', user.id);
    console.log('[STRIPE CHECKOUT] User email:', userEmail);
    console.log('[STRIPE CHECKOUT] Existing customer ID:', customerId || 'none');

    // If user doesn't have a Stripe customer ID, create one
    if (!customerId) {
      console.log('[STRIPE CHECKOUT] Creating new Stripe customer for:', userEmail);
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { authId }
      });
      customerId = customer.id;

      // Save the Stripe customer ID to the user
      const { error: updateError } = await req.supabaseAdmin
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);

      if (updateError) {
        console.error('[STRIPE CHECKOUT] ERROR: Failed to save customer ID:', updateError);
      }

      console.log('[STRIPE CHECKOUT] Stripe customer created:', customerId);
    }

    // Determine success/cancel URLs
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    console.log('[STRIPE CHECKOUT] Frontend URL:', frontendUrl);

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${frontendUrl}#/account?checkout=success`,
      cancel_url: `${frontendUrl}#/account?checkout=cancel`,
      metadata: { authId }
    });

    console.log('[STRIPE CHECKOUT] Checkout session created:', session.id);
    console.log('[STRIPE CHECKOUT] Session URL:', session.url);
    console.log('========================================\n');

    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('[STRIPE CHECKOUT] ERROR:', error);
    console.error('[STRIPE CHECKOUT] Error message:', error.message);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
