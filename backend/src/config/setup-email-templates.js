/**
 * Setup Auth0 Email Templates
 * Run this script once to configure custom email templates in Auth0
 *
 * Usage: node src/config/setup-email-templates.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Auth0Service = require('../services/Auth0Service');

async function setupEmailTemplates() {
  console.log('Setting up Auth0 email templates...\n');

  if (!Auth0Service.isConfigured()) {
    console.error('Error: Auth0 is not configured. Please set AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET in .env');
    process.exit(1);
  }

  try {
    // Read the verification email template
    const templatePath = path.join(__dirname, '../templates/verification-email.html');
    const htmlContent = fs.readFileSync(templatePath, 'utf8');

    // Configure the verification email template
    await Auth0Service.configureEmailTemplate(
      'verify_email',
      htmlContent,
      'Verificar E-mail - BT4500'
    );

    console.log('\n✓ Verification email template configured successfully!');
    console.log('\nYou can also customize templates in Auth0 Dashboard:');
    console.log('  → Branding → Email Templates → Verification Email\n');

  } catch (error) {
    console.error('Failed to setup email templates:', error.message);
    console.log('\nNote: Make sure your Auth0 Management API has the following permissions:');
    console.log('  - read:email_templates');
    console.log('  - update:email_templates');
    console.log('  - create:email_templates\n');
    process.exit(1);
  }
}

setupEmailTemplates();
