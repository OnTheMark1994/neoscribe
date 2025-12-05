import React, { useState } from 'react';
import './HelpPage.css';

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
  const handleBackupCancel = async () => {
    // This button is intended as a backup when Stripe's portal login isn't working
    // because the user no longer has access to the email used at checkout.
    // For now, direct users to contact support so we can cancel from our side.
    // When a dedicated server endpoint exists, wire it up here.
    window.location.href = 'mailto:support@scribefold.ai?subject=Cancel%20subscription&body=Please%20cancel%20my%20ScribeFold%20AI%20subscription.%20Include%20the%20email%20you%20used%20at%20checkout%20and%20last%204%20digits%20of%20your%20card.';
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
        >
          Cancel Subscription Here
        </button>
        <p className="sf-help-note">
          When you click this, it opens an email to our support team. Please include the
          email you used at checkout and any details that help us locate your Stripe
          subscription (such as the last 4 digits of your card). We&apos;ll cancel the
          subscription on our side if we can&apos;t resolve the portal login issue.
        </p>
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
