const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');

/**
 * Verify Auth0 webhook signature
 * Auth0 signs webhooks with a shared secret
 */
function verifyAuth0Signature(req, res, next) {
  const webhookSecret = process.env.AUTH0_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('AUTH0_WEBHOOK_SECRET not configured - webhook verification disabled');
    return next();
  }

  const signature = req.headers['x-auth0-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

/**
 * POST /api/webhooks/auth0/user-deleted
 * Called by Auth0 when a user is deleted from Auth0 Dashboard
 *
 * To set this up in Auth0:
 * 1. Go to Auth0 Dashboard → Actions → Flows → Post User Delete
 * 2. Create a custom action that calls this endpoint
 * 3. Or use Auth0 Log Streams to trigger on user deletion events
 */
router.post('/auth0/user-deleted', verifyAuth0Signature, async (req, res) => {
  try {
    const { user_id, email } = req.body;

    if (!user_id && !email) {
      return res.status(400).json({ error: 'user_id or email required' });
    }

    console.log(`Auth0 webhook: User deleted - ${email || user_id}`);

    // Find user by Auth0 ID or email
    let user = null;
    if (user_id) {
      user = await User.findByAuth0IdIncludingInactive(user_id);
    }
    if (!user && email) {
      user = await User.findByEmailIncludingInactive(email);
    }

    if (!user) {
      console.log('User not found in local database');
      return res.json({ message: 'User not found', action: 'none' });
    }

    // Deactivate the user (soft delete)
    await User.deactivate(user.id, 'auth0_deleted');
    console.log(`User ${user.email} deactivated successfully`);

    res.json({
      message: 'User deactivated',
      action: 'deactivated',
      userId: user.uuid
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/webhooks/auth0/user-created
 * Optional: Called by Auth0 when a user is created
 * Useful for syncing users created directly in Auth0 Dashboard
 */
router.post('/auth0/user-created', verifyAuth0Signature, async (req, res) => {
  try {
    const { user_id, email, email_verified } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email required' });
    }

    console.log(`Auth0 webhook: User created - ${email}`);

    // Check if user exists (might be a reactivation case)
    const existingUser = await User.findByEmailIncludingInactive(email);

    if (existingUser) {
      if (!existingUser.active) {
        // Reactivate the user
        await User.reactivate(existingUser.id, {
          auth0Id: user_id,
          emailVerified: email_verified
        });
        console.log(`User ${email} reactivated`);
        return res.json({ message: 'User reactivated', action: 'reactivated' });
      }
      // User already exists and is active
      return res.json({ message: 'User already exists', action: 'none' });
    }

    // Create new user
    const newUser = await User.create({
      email,
      auth0Id: user_id,
      emailVerified: email_verified,
      role: 'player'
    });

    console.log(`User ${email} created from Auth0 webhook`);
    res.json({ message: 'User created', action: 'created', userId: newUser.uuid });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
