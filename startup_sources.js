// startup_sources.js
// Add more anytime. "slug" is the company identifier used by the platform.

export const STARTUP_SOURCES = [
  // Greenhouse board slugs:
  { platform: "greenhouse", name: "Stripe", slug: "stripe" },
  { platform: "greenhouse", name: "Coinbase", slug: "coinbase" },
  { platform: "greenhouse", name: "Shopify", slug: "shopify" },
  { platform: "greenhouse", name: "GitLab", slug: "gitlab" },

  // Lever slugs:
  { platform: "lever", name: "Automattic", slug: "automattic" }
];

/**
 * Auto-apply happens ONLY when an application email exists here.
 * Put known careers inboxes or recruiter emails.
 *
 * If a company doesn't have an email here → status will be NEEDS_1_CLICK.
 */
export const APPLY_EMAIL_BY_COMPANY = {
  // Example:
  // "Some Startup": "careers@somestartup.com"
};
