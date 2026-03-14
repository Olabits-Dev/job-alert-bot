// job-alert.js
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { Resend } from "resend";

import { SOURCES } from "./sources.js";
import { PROFILES } from "./profiles.js";
import { STARTUP_SOURCES, APPLY_EMAIL_BY_COMPANY } from "./startup_sources.js";
import { sendApplicationEmail, sendDailyReport } from "./apply_engine.js";
import { extractEmailsFromText } from "./email_finder.js";

const PROFILE_KEY = (process.env.PROFILE || "dev").toLowerCase();
const PROFILE = PROFILES[PROFILE_KEY] || PROFILES.dev;
const KEYWORDS = PROFILE.keywords;
const CANDIDATE = PROFILE.candidate;
const PREFERENCES = PROFILE.preferences || {};
  
const resend = new Resend(process.env.RESEND_API_KEY);

// report email
const REPORT_TO = process.env.REPORT_TO || "atilolasamuel15@gmail.com";

const CACHE_DIR = ".cache";
const SEEN_FILE = path.join(CACHE_DIR, "seen.json");
const APPLY_LOG_FILE = path.join(CACHE_DIR, "applications.json");

const xmlParser = new XMLParser({ ignoreAttributes: false });

const norm = (s = "") => String(s).toLowerCase().trim();
const safeArr = (x) => (Array.isArray(x) ? x : x ? [x] : []);

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function saveJson(file, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function containsAny(text, words) {
  const t = norm(text);
  return words.some((w) => t.includes(norm(w)));
}

/* ---------------- EMAIL DISCOVERY ---------------- */

async function discoverRecruiterEmail(jobUrl) {
  try {
    const res = await fetch(jobUrl, {
      headers: { "User-Agent": "job-bot" }
    });

    if (!res.ok) return null;

    const html = await res.text();
    const emails = extractEmailsFromText(html);

    if (emails.length > 0) return emails[0];
  } catch (err) {
    console.log("Email discovery failed:", err.message);
  }

  return null;
}

/* ---------------- JOB SCORING ---------------- */

function scoreJob(job) {
  const hay = norm(
    `${job.title} ${job.company} ${job.description || ""} ${(job.tags || []).join(" ")}`
  );

  if (containsAny(hay, KEYWORDS.avoid)) return -999;

  let score = 0;

  for (const k of KEYWORDS.strong) {
    if (hay.includes(norm(k))) score += 3;
  }

  for (const k of KEYWORDS.web3Boost) {
    if (hay.includes(norm(k))) score += 1;
  }

  if (hay.includes("remote") || hay.includes("worldwide")) score += 3;
  if (hay.includes("contract") || hay.includes("freelance")) score += 2;
  if (hay.includes("engineer") || hay.includes("developer")) score += 1;

  return score;
}

function explainMatch(job) {
  const hay = norm(`${job.title} ${job.company} ${job.description || ""}`);

  const hitsStrong = KEYWORDS.strong.filter((k) => hay.includes(norm(k)));
  const hitsWeb3 = KEYWORDS.web3Boost.filter((k) => hay.includes(norm(k)));

  const reasons = [];

  if (hitsStrong.length) {
    reasons.push(`Stack: ${hitsStrong.slice(0, 6).join(", ")}`);
  }

  if (hitsWeb3.length) {
    reasons.push(`Web3: ${hitsWeb3.slice(0, 6).join(", ")}`);
  }

  if (hay.includes("remote")) reasons.push("Remote");
  if (hay.includes("contract") || hay.includes("freelance")) reasons.push("Contract");

  return reasons.length ? reasons.join(" • ") : "General match";
}
function buildPitch(job) {
  const companyLine = job.company ? `Hi ${job.company} team,` : "Hi,";

  if (PROFILE_KEY === "precious_support") {
    return `${companyLine}

My name is ${CANDIDATE.name} and I am applying for the "${job.title}" role.

I have 3 years of experience in customer service and support environments, including phone, email, chat, and social media support. I currently work as a Customer Service Call Center Representative at Irecharge Tech Innovation Abuja.

My experience includes:
• Handling customer enquiries and complaints professionally
• Resolving and escalating customer issues appropriately
• Updating CRM and call logs accurately
• Supporting customers across phone, email, chat, and social media
• Using Intercom, Freshdesk, CRM tools, and LiveChat

I am open to remote UK roles and remote or hybrid Nigeria roles, and I am available for shift work.

Best regards,
${CANDIDATE.name}
${CANDIDATE.phone}
${CANDIDATE.email}`;
  }

  return `${companyLine}

I’m ${CANDIDATE.name} — a Frontend & Software Engineer specializing in React, Node.js/Express and PostgreSQL.

I’m applying for the "${job.title}" role.

Highlights of my work:
• React web applications and SaaS dashboards
• Node.js/Express APIs with PostgreSQL
• automation and fintech-style systems

Portfolio
${CANDIDATE.portfolio}

GitHub
${CANDIDATE.github}

If the role supports global remote developers I would love to contribute.

Best regards,
${CANDIDATE.name}
${CANDIDATE.phone}
Email: ${CANDIDATE.email}`;
}

/* ---------------- JOB SOURCES ---------------- */

async function fetchRemoteOk() {
  const res = await fetch("https://remoteok.com/api");
  const data = await res.json();

  return data
    .filter((x) => x && x.id && x.position)
    .map((x) => ({
      source: "RemoteOK",
      title: x.position,
      company: x.company,
      url: x.url,
      tags: safeArr(x.tags),
      description: x.description || "",
      date: x.date || ""
    }));
}

async function fetchRss(url, sourceName) {
  const res = await fetch(url);
  const xml = await res.text();

  const parsed = xmlParser.parse(xml);
  const items = safeArr(parsed?.rss?.channel?.item);

  return items.map((it) => ({
    source: sourceName,
    title: it.title,
    company: "",
    url: it.link,
    description: it.description || "",
    date: it.pubDate || ""
  }));
}

async function fetchGreenhouseBoard(slug, name) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
  const res = await fetch(url);
  const data = await res.json();

  return safeArr(data.jobs).map((j) => ({
    source: `Greenhouse: ${name}`,
    title: j.title,
    company: name,
    url: j.absolute_url,
    description: "",
    date: j.updated_at || j.created_at || ""
  }));
}

async function fetchLever(slug, name) {
  const url = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const res = await fetch(url);
  const data = await res.json();

  return safeArr(data).map((j) => ({
    source: `Lever: ${name}`,
    title: j.text,
    company: name,
    url: j.hostedUrl,
    description: j.descriptionPlain || "",
    date: j.createdAt ? new Date(j.createdAt).toISOString() : ""
  }));
}

async function fetchAshby(slug, name) {
  const url = `https://jobs.ashbyhq.com/${slug}`;
  const res = await fetch(url);
  const html = await res.text();

  const matches = [...html.matchAll(/href="(\/job\/[^"]+)"/g)];

  return matches.map((m) => ({
    source: `Ashby: ${name}`,
    title: "Startup Role",
    company: name,
    url: `https://jobs.ashbyhq.com${m[1]}`,
    description: "",
    date: ""
  }));
}

/* ---------------- COLLECT JOBS ---------------- */

async function collectJobs() {
  const all = [];

  for (const src of SOURCES) {
    try {
      if (src.type === "json") all.push(...(await fetchRemoteOk()));
      else if (src.type === "rss") all.push(...(await fetchRss(src.url, src.name)));
    } catch (e) {
      console.error("Source failed:", src.name);
    }
  }

  for (const s of STARTUP_SOURCES) {
    try {
      if (s.platform === "greenhouse") {
        all.push(...(await fetchGreenhouseBoard(s.slug, s.name)));
      }

      if (s.platform === "lever") {
        all.push(...(await fetchLever(s.slug, s.name)));
      }

      if (s.platform === "ashby") {
        all.push(...(await fetchAshby(s.slug, s.name)));
      }
    } catch (e) {
      console.error("Startup source failed:", s.name);
    }
  }

  return all;
}

/* ---------------- HTML HELPERS ---------------- */

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportHtml(dateStr, results) {
  const renderPitch = (pitch = "") => `
    <div style="margin-top:10px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
      <div style="font-weight:700;margin-bottom:8px;">Tailored Pitch</div>
      <div style="white-space:pre-wrap;line-height:1.6;color:#111827;">${escapeHtml(pitch)}</div>
    </div>
  `;

  const renderJobCard = (j, i, includePitch = false, includeApplyLink = true) => `
    <div style="padding:14px;border:1px solid #e5e7eb;border-radius:12px;margin:12px 0;background:#ffffff;">
      <div style="font-weight:900;font-size:16px;color:#111827;">
        ${i + 1}. ${escapeHtml(j.title)}
        <span style="color:#6b7280;font-weight:700;font-size:13px;">(Score ${j.score})</span>
      </div>

      <div style="margin-top:8px;color:#374151;line-height:1.6;">
        <div><b>Company:</b> ${escapeHtml(j.company || "Not specified")}</div>
        <div><b>Source:</b> ${escapeHtml(j.source || "Unknown")}</div>
        ${j.date ? `<div><b>Date:</b> ${escapeHtml(j.date)}</div>` : ""}
        <div><b>Why it matched:</b> ${escapeHtml(j.matchWhy || "General match")}</div>
      </div>

      ${
        includeApplyLink
          ? `<div style="margin-top:10px;">
              <b>Need click link:</b>
              <a href="${j.url}" target="_blank" rel="noreferrer" style="color:#2563eb;word-break:break-all;">
                ${escapeHtml(j.url)}
              </a>
            </div>`
          : ""
      }

      ${includePitch ? renderPitch(j.pitch) : ""}
    </div>
  `;

  const section = (title, items, options = {}) => `
    <h3 style="margin-top:22px;color:#111827;">${title} (${items.length})</h3>
    ${
      items.length
        ? items
            .map((j, i) => renderJobCard(j, i, options.includePitch, options.includeApplyLink))
            .join("")
        : `<p style="color:#6b7280;">None.</p>`
    }
  `;

  return `
  <div style="font-family:Arial,sans-serif;max-width:900px;margin:auto;padding:20px;background:#f8fafc;">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:20px;">
      <h2 style="margin:0;color:#111827;">Daily Job Bot Report — ${escapeHtml(dateStr)}</h2>
      <p style="color:#4b5563;margin:10px 0 0;line-height:1.6;">
        Mode: Balanced (Software + Web3) • Auto-apply: Email only • CV attached when auto-applied
      </p>

      <div style="margin-top:18px;padding:14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;">
        <div style="font-size:15px;color:#111827;"><b>Summary</b></div>
        <div style="margin-top:8px;color:#374151;line-height:1.8;">
          <div>Applied: <b>${results.applied.length}</b></div>
          <div>Needs click: <b>${results.needsClick.length}</b></div>
          <div>Skipped: <b>${results.skipped.length}</b></div>
        </div>
      </div>

      ${section("AUTO-APPLIED ✅", results.applied, {
        includePitch: true,
        includeApplyLink: true
      })}

      ${section("NEEDS 1-CLICK ⏳", results.needsClick, {
        includePitch: true,
        includeApplyLink: true
      })}

      ${section("SKIPPED ❌", results.skipped, {
        includePitch: false,
        includeApplyLink: true
      })}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0;" />
      <p style="color:#6b7280;font-size:13px;line-height:1.7;margin:0;">
        Portfolio:
        <a href="https://olabits-landing-page.onrender.com" target="_blank" rel="noreferrer">
          https://olabits-landing-page.onrender.com
        </a>
        <br/>
        GitHub:
        <a href="https://github.com/Olabits-Dev" target="_blank" rel="noreferrer">
          https://github.com/Olabits-Dev
        </a>
      </p>
    </div>
  </div>
  `;
}

/* ---------------- MAIN BOT ---------------- */

async function main() {
  const dateStr = new Date().toLocaleDateString();

  const seen = new Set(loadJson(SEEN_FILE, []));
  const applyLog = loadJson(APPLY_LOG_FILE, []);

  const jobs = await collectJobs();

  const ranked = jobs
    .map((j) => ({ ...j, score: scoreJob(j) }))
    .filter((j) => j.score >= 10)
    .filter((j) => !seen.has(j.url))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map((j) => ({
      ...j,
      matchWhy: explainMatch(j),
      pitch: buildPitch(j)
    if (PROFILE_KEY === "precious_support") {
  if (hay.includes("£") || hay.includes("gbp")) score += 2;
  if (hay.includes("₦") || hay.includes("ngn")) score += 2;
  if (hay.includes("customer") || hay.includes("support")) score += 2;
}
    }));

  const results = { applied: [], needsClick: [], skipped: [] };

  for (const job of ranked) {
    let applyEmail = APPLY_EMAIL_BY_COMPANY[job.company];

    if (!applyEmail) {
      applyEmail = await discoverRecruiterEmail(job.url);
    }

    if (applyEmail) {
      const applicationHtml = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;">
          <p style="white-space:pre-wrap;">${escapeHtml(job.pitch)}</p>
          <p><b>Job link:</b> <a href="${job.url}" target="_blank" rel="noreferrer">${escapeHtml(job.url)}</a></p>
        </div>
      `;

      try {
        await sendApplicationEmail({
          to: applyEmail,
          subject: `Application: ${job.title}`,
          html: applicationHtml
        });

        results.applied.push(job);
        applyLog.push({
          date: new Date().toISOString(),
          status: "APPLIED_EMAIL",
          company: job.company,
          title: job.title,
          url: job.url,
          to: applyEmail
        });
      } catch (e) {
        results.needsClick.push(job);
        applyLog.push({
          date: new Date().toISOString(),
          status: "FAILED_EMAIL_NEEDS_CLICK",
          company: job.company,
          title: job.title,
          url: job.url,
          attemptedEmail: applyEmail,
          error: String(e?.message || e)
        });
      }
    } else {
      results.needsClick.push(job);
      applyLog.push({
        date: new Date().toISOString(),
        status: "NEEDS_CLICK",
        company: job.company,
        title: job.title,
        url: job.url
      });
    }

    seen.add(job.url);
  }

  saveJson(SEEN_FILE, [...seen]);
  saveJson(APPLY_LOG_FILE, applyLog);

  const html = reportHtml(dateStr, results);

  await sendDailyReport({
    to: REPORT_TO,
    subject: `Daily Job Bot — ${dateStr} (Applied: ${results.applied.length}, Needs 1-click: ${results.needsClick.length})`,
    html
  });
}

main().catch((err) => {
  console.error("Fatal job-alert error:", err);
  process.exit(1);
});
