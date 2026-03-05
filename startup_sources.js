// startup_sources.js
// Expanded scanner: Greenhouse + Lever company slugs.
// Greenhouse API pattern: https://boards-api.greenhouse.io/v1/boards/<slug>/jobs
// Lever API pattern: https://api.lever.co/v0/postings/<slug>?mode=json
// Docs: Greenhouse Job Board API + Lever postings API :contentReference[oaicite:1]{index=1}

export const STARTUP_SOURCES = [
  // ---------------------------
  // Web3 / Crypto heavy (GH)
  // ---------------------------
  { platform: "greenhouse", name: "Alchemy", slug: "alchemy" },
  { platform: "greenhouse", name: "Fireblocks", slug: "fireblocks" },
  { platform: "greenhouse", name: "Figment", slug: "figment" },
  { platform: "greenhouse", name: "Horizen", slug: "horizen" },

  // ---------------------------
  // Big tech / scaleups (GH)
  // ---------------------------
  { platform: "greenhouse", name: "Coinbase", slug: "coinbase" }, // GH board exists :contentReference[oaicite:2]{index=2}
  { platform: "greenhouse", name: "Intercom", slug: "intercom" },
  { platform: "greenhouse", name: "Mixpanel", slug: "mixpanel" },
  { platform: "greenhouse", name: "Webflow", slug: "webflow" },
  { platform: "greenhouse", name: "Calendly", slug: "calendly" },
  { platform: "greenhouse", name: "CircleCI", slug: "circleci" },
  { platform: "greenhouse", name: "LaunchDarkly", slug: "launchdarkly" },
  { platform: "greenhouse", name: "Roblox", slug: "roblox" },
  { platform: "greenhouse", name: "Zocdoc", slug: "zocdoc" },
  { platform: "greenhouse", name: "Trustpilot", slug: "trustpilot" },

  // ---------------------------
  // Fintech / SaaS (GH)
  // ---------------------------
  { platform: "greenhouse", name: "Carta", slug: "carta" },
  { platform: "greenhouse", name: "Earnin", slug: "earnin" },
  { platform: "greenhouse", name: "Upstart", slug: "upstart" },
  { platform: "greenhouse", name: "Truework", slug: "truework" },
  { platform: "greenhouse", name: "Vanta", slug: "vanta" }, // (note: some sources list as Ashby; keep if GH works for you)
  { platform: "greenhouse", name: "Verkada", slug: "verkada" },

  // ---------------------------
  // Productivity / Dev tools (GH)
  // ---------------------------
  { platform: "greenhouse", name: "Dialpad", slug: "dialpad" },
  { platform: "greenhouse", name: "Iterable", slug: "iterable" },
  { platform: "greenhouse", name: "Descript", slug: "descript" },
  { platform: "greenhouse", name: "TaskRabbit", slug: "taskrabbit" },
  { platform: "greenhouse", name: "Workato", slug: "workato" },
  { platform: "greenhouse", name: "Wrike", slug: "wrike" },

  // ---------------------------
  // Security / infra (GH)
  // ---------------------------
  { platform: "greenhouse", name: "Abnormal Security", slug: "abnormalsecurity" },
  { platform: "greenhouse", name: "Expel", slug: "expel" },
  { platform: "greenhouse", name: "Tigera", slug: "tigera" },
  { platform: "greenhouse", name: "Zscaler", slug: "zscaler" },

  // ---------------------------
  // Marketplace / consumer (GH)
  // ---------------------------
  { platform: "greenhouse", name: "Calm", slug: "calm" },
  { platform: "greenhouse", name: "ClassPass", slug: "classpass" },
  { platform: "greenhouse", name: "Dollar Shave Club", slug: "dollarshaveclub" },
  { platform: "greenhouse", name: "Traeger", slug: "traeger" },

  // ---------------------------
  // Enterprise / data (GH)
  // ---------------------------
  { platform: "greenhouse", name: "DeepMind", slug: "deepmind" },
  { platform: "greenhouse", name: "Indeed", slug: "indeed" },
  { platform: "greenhouse", name: "Labelbox", slug: "labelbox" },
  { platform: "greenhouse", name: "Moveworks", slug: "moveworks" },
  { platform: "greenhouse", name: "Nuro", slug: "nuro" },

  // ---------------------------
  // Lever sources (form boards)
  // ---------------------------
  { platform: "lever", name: "Automattic", slug: "automattic" }, // Lever API supports mode=json :contentReference[oaicite:3]{index=3}
  { platform: "lever", name: "Plaid", slug: "plaid" },
  { platform: "lever", name: "Outreach", slug: "outreach" },
  { platform: "lever", name: "Palantir", slug: "palantir" },

  // Add more Lever companies here as you like:
  // { platform: "lever", name: "CompanyName", slug: "companyslug" },
];

/**
 * Auto-apply happens ONLY when an application email exists here.
 * Put known careers inboxes or recruiter emails.
 * If a company isn't here → status will be NEEDS_1_CLICK (form link).
 */
export const APPLY_EMAIL_BY_COMPANY = {
  // Example:
  // "Intercom": "careers@intercom.com",
};
