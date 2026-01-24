import React, { useState } from 'react';
import './Help.css';

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

const Help = () => {
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
          style={{
            backgroundColor: '#dc3545',
            borderColor: '#dc3545',
            color: '#3b0202',
          }}
        >
          Cancel All Subscriptions Here
        </button>
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

export default Help;
