import React, { useState } from 'react';
import './HelpPage.css';
import { useAuth } from '../AuthContext';
import { API_BASE_URL } from '../constants';

const FoldSection = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="sf-help-section">
      <button
        type="button"
        className="sf-help-section-header"
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span className="sf-help-section-toggle">{open ? '-' : '+'}</span>
      </button>
      {open && <div className="sf-help-section-body">{children}</div>}
    </div>
  );
};

const HelpPage = () => {
  const { user } = useAuth();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelStatusMsg, setCancelStatusMsg] = useState('');

  const handleBackupCancel = async () => {
    if (!user) {
      setCancelStatusMsg('You need to be signed in to cancel your subscription from here.');
      return;
    }

    const confirmed = window.confirm(
      'Use this only if the Stripe portal login is not working for your email.\n\n' +
      'This will attempt to cancel ALL active subscriptions associated with your email address.\n\n' +
      'Are you sure you want to continue?'
    );

    if (!confirmed) return;

    try {
      setCancelLoading(true);
      setCancelStatusMsg('Contacting Stripe to cancel your subscriptions...');

      const response = await fetch(`${API_BASE_URL}/api/stripe/cancel-all-subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authId: user.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to cancel subscriptions');
      }

      setCancelStatusMsg(`✓ ${data.message}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[HELP] Backup cancel error:', err);
      setCancelStatusMsg(`✗ ${err.message}`);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="sf-page sf-help-page">
      <header className="sf-page-header">
        <h1>Help &amp; Support</h1>
        <p>
          Find answers to common questions, manage your subscription, and learn what to do if
          Stripe&apos;s customer portal isn&apos;t working for your email.
        </p>
      </header>

      <FoldSection title="Managing your subscription" defaultOpen>
        <p>
          The primary way to upgrade, downgrade, or cancel your subscription is through the
          Stripe customer portal. From the Account page, use the &quot;Manage Subscription&quot;
          button to open Stripe&apos;s secure portal, where you can change plans or cancel at
          the end of the billing period.
        </p>
      </FoldSection>

      <FoldSection title="Stripe subscription manager not working?">
        <p>
          In rare cases, users sign up with an email address they no longer control, or with
          a mistyped/temporary email. Stripe uses that email for login to the customer portal,
          so if you can&apos;t access it you may not be able to log in to manage or cancel your
          subscription.
        </p>
        <p>
          If you see a message like &quot;We sent a link to an email you can&apos;t access&quot; when
          trying to open the Stripe portal, use the button below as a backup way to request
          cancellation.
        </p>
        <button
          type="button"
          className="sf-secondary-btn sf-secondary-btn-neutral sf-help-cancel-btn"
          onClick={handleBackupCancel}
          disabled={cancelLoading}
          style={{
            backgroundColor: '#dc3545',
            borderColor: '#dc3545',
            color: '#3b0202',
          }}
        >
          {cancelLoading ? 'Canceling subscriptions...' : 'Cancel All Subscriptions Here'}
        </button>
        {cancelStatusMsg && (
          <p className="sf-help-note" style={{ marginTop: '8px' }}>
            {cancelStatusMsg}
          </p>
        )}
      </FoldSection>

      <FoldSection title="General questions">
        <p>
          For general questions about ScribeFold AI, feature requests, or bug reports, feel
          free to reach out to support@scribefold.ai. We&apos;re always improving the app and
          your feedback is very helpful.
        </p>
      </FoldSection>
    </div>
  );
};

export default HelpPage;
