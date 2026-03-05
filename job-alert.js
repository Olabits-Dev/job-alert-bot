// job-alert.js
import fs from "fs";
import path from "path";
import { XMLParser } from "fast-xml-parser";
import { Resend } from "resend";

import { SOURCES, KEYWORDS } from "./sources.js";
import { STARTUP_SOURCES, APPLY_EMAIL_BY_COMPANY } from "./startup_sources.js";
import { sendApplicationEmail, sendDailyReport } from "./apply_engine.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// You receive reports here (can add your yahoo later after domain verification)
const REPORT_TO = "atilolasamuel15@gmail.com";

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

function scoreJob(job) {
  const hay = norm(`${job.title} ${job.company} ${job.description || ""} ${(job.tags || []).join(" ")}`);

  if (containsAny(hay, KEYWORDS.avoid)) return -999;

  let score = 0;

  for (const k of KEYWORDS.strong) if (hay.includes(norm(k))) score += 3;
  for (const k of KEYWORDS.web3Boost) if (hay.includes(norm(k))) score += 1;

  if (hay.includes("remote") || hay.includes("worldwide")) score += 3;
  if (hay.includes("contract") || hay.includes("freelance")) score += 2;
  if (hay.includes("engineer") || hay.includes("developer")) score += 1;

  return score;
}

function explainMatch(job) {
  const hay = norm(`${job.title} ${job.company} ${job.description || ""} ${(job.tags || []).join(" ")}`);
  const hitsStrong = KEYWORDS.strong.filter((k) => hay.includes(norm(k)));
  const hitsWeb3 = KEYWORDS.web3Boost.filter((k) => hay.includes(norm(k)));

  const reasons = [];
  if (hitsStrong.length) reasons.push(`Stack: ${hitsStrong.slice(0, 6).join(", ")}`);
  if (hitsWeb3.length) reasons.push(`Web3/Crypto: ${hitsWeb3.slice(0, 6).join(", ")}`);
  if (hay.includes("remote") || hay.includes("worldwide")) reasons.push("Remote-friendly");
  if (hay.includes("contract") || hay.includes("freelance")) reasons.push("Contract mention");
  return reasons.length ? reasons.join(" • ") : "General match";
}

function buildPitch(job) {
  const companyLine = job.company ? `Hi ${job.company} team,` : "Hi,";
  return `${companyLine}

I’m Samuel Olawale Atilola — a Frontend & Software Engineer (React, Node.js/Express, PostgreSQL), available immediately for remote contract work.

I’m applying for the "${job.title}" role. Highlights:
• React UI + responsive web apps (HTML/CSS/JavaScript)
• Node.js/Express APIs + PostgreSQL data layer
• Automation systems and fintech/crypto-style workflows

Portfolio: https://olabits-landing-page.onrender.com
GitHub: https://github.com/Olabits-Dev

If you’re open to global remote candidates, I’d love to be considered.

Best regards,
Samuel Olawale Atilola
+234 803 520 8600
Email: atilolasamuel15@gmail.com`;
}

async function fetchRemoteOk() {
  const res = await fetch("https://remoteok.com/api", { headers: { "User-Agent": "job-alert-bot" } });
  if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);
  const data = await res.json();

  return data
    .filter((x) => x && x.id && x.position)
    .map((x) => ({
      source: "RemoteOK",
      title: x.position,
      company: x.company || "",
      url: x.url || x.apply_url || `https://remoteok.com/remote-jobs/${x.id}`,
      date: x.date || "",
      tags: safeArr(x.tags),
      description: x.description || ""
    }))
    .filter((j) => j.url && j.title);
}

async function fetchRss(url, sourceName) {
  const res = await fetch(url, { headers: { "User-Agent": "job-alert-bot" } });
  if (!res.ok) throw new Error(`RSS fetch failed (${sourceName}): ${res.status}`);
  const xml = await res.text();

  const parsed = xmlParser.parse(xml);
  const items = safeArr(parsed?.rss?.channel?.item);

  return items
    .map((it) => ({
      source: sourceName,
      title: String(it.title?.["#text"] ?? it.title ?? "Untitled"),
      company: "",
      url: String(it.link?.["@_href"] ?? it.link ?? it.guid ?? "").trim(),
      date: String(it.pubDate ?? ""),
      tags: [],
      description: String(it.description?.["#text"] ?? it.description ?? "")
    }))
    .filter((j) => j.url && j.title);
}

// --- Startup sources ---
async function fetchGreenhouseBoard(slug, name) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs`;
  const res = await fetch(url, { headers: { "User-Agent": "job-alert-bot" } });
  if (!res.ok) throw new Error(`Greenhouse fetch failed (${name}): ${res.status}`);
  const data = await res.json();

  return safeArr(data?.jobs)
    .map((j) => ({
      source: `Greenhouse: ${name}`,
      title: j.title,
      company: name,
      url: j.absolute_url,
      date: j.updated_at || j.created_at || "",
      tags: safeArr(j.metadata?.map?.((m) => m.value) ?? []),
      description: "" // greenhouse description requires per-job fetch; keeping light
    }))
    .filter((j) => j.url && j.title);
}

async function fetchAshby(slug, name) {

  const url = `https://jobs.ashbyhq.com/${slug}`;

  const res = await fetch(url, {
    headers: { "User-Agent": "job-alert-bot" }
  });

  if (!res.ok) {
    throw new Error(`Ashby fetch failed (${name}): ${res.status}`);
  }

  const html = await res.text();

  const matches = [...html.matchAll(/href="(\/job\/[^"]+)"/g)];

  return matches.map(m => ({
    source: `Ashby: ${name}`,
    title: "Startup Role",
    company: name,
    url: `https://jobs.ashbyhq.com${m[1]}`,
    date: "",
    tags: [],
    description: ""
  }));
}

async function fetchLever(slug, name) {
  const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
  const res = await fetch(url, { headers: { "User-Agent": "job-alert-bot" } });
  if (!res.ok) throw new Error(`Lever fetch failed (${name}): ${res.status}`);
  const data = await res.json();

  return safeArr(data)
    .map((j) => ({
      source: `Lever: ${name}`,
      title: j.text,
      company: name,
      url: j.hostedUrl,
      date: j.createdAt ? new Date(j.createdAt).toISOString() : "",
      tags: safeArr(j.categories ? Object.values(j.categories) : []),
      description: j.descriptionPlain || ""
    }))
    .filter((j) => j.url && j.title);
}

async function collectJobs() {
  const all = [];

  // Existing sources (RemoteOK + RSS)
  for (const src of SOURCES) {
    try {
      if (src.type === "json" && src.url.includes("remoteok.com/api")) all.push(...await fetchRemoteOk());
      else if (src.type === "rss") all.push(...await fetchRss(src.url, src.name));
    } catch (e) {
      console.error(`Source failed: ${src.name}`, e?.message || e);
    }
  }

  // Startup boards
  for (const s of STARTUP_SOURCES) {
    try {
      if (s.platform === "greenhouse") all.push(...await fetchGreenhouseBoard(s.slug, s.name));
      if (s.platform === "lever") all.push(...await fetchLever(s.slug, s.name));
    } catch (e) {
      console.error(`Startup source failed: ${s.name}`, e?.message || e);
    }
  }

  return all;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function reportHtml(dateStr, results) {
  const section = (title, items) => `
    <h3 style="margin-top:18px;">${title} (${items.length})</h3>
    ${items.length ? items.map((j, i) => `
      <div style="padding:12px;border:1px solid #eee;border-radius:12px;margin:10px 0;">
        <div style="font-weight:900;">${i + 1}. ${escapeHtml(j.title)} <span style="color:#666;font-weight:700;">(Score ${j.score})</span></div>
        <div style="color:#555;margin-top:6px;">
          <b>${escapeHtml(j.company || "Company")}</b> • ${escapeHtml(j.source)}
        </div>
        <div style="color:#666;margin-top:6px;"><b>Why:</b> ${escapeHtml(j.matchWhy)}</div>
        <div style="margin-top:8px;"><a href="${j.url}" target="_blank" rel="noreferrer">Open listing</a></div>
      </div>
    `).join("") : `<p style="color:#666;">None.</p>`}
  `;

  return `
  <div style="font-family:Arial,sans-serif;max-width:860px;margin:auto;padding:18px;">
    <h2 style="margin:0;">Daily Job Bot Report — ${dateStr}</h2>
    <p style="color:#555;margin:10px 0 0;">
      Mode: Balanced (Software + Web3) • Auto-apply: Email only • CV attached when auto-applied
    </p>

    ${section("AUTO-APPLIED ✅", results.applied)}
    ${section("NEEDS 1-CLICK ⏳", results.needsClick)}
    ${section("SKIPPED ❌", results.skipped)}

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="color:#666;font-size:13px;margin:0;">
      Portfolio: <a href="https://olabits-landing-page.onrender.com">olabits-landing-page.onrender.com</a><br/>
      GitHub: <a href="https://github.com/Olabits-Dev">github.com/Olabits-Dev</a>
    </p>
  </div>
  `;
}

async function main() {
  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });

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
    }));

  // Classify + apply where email exists
  const results = { applied: [], needsClick: [], skipped: [] };

  for (const job of ranked) {
    const applyEmail = APPLY_EMAIL_BY_COMPANY[job.company];

    if (applyEmail) {
      // Auto-apply by email
      const subject = `Application: ${job.title} — ${job.company}`;
      const html = `
        <div style="font-family:Arial,sans-serif;">
          <p style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(job.pitch)}</p>
          <p><b>Job link:</b> <a href="${job.url}">${job.url}</a></p>
        </div>
      `;

      try {
        await sendApplicationEmail({ to: applyEmail, subject, html });
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
        // If apply email fails, fall back to needs-click
        results.needsClick.push(job);
        applyLog.push({
          date: new Date().toISOString(),
          status: "FAILED_EMAIL_NEEDS_CLICK",
          company: job.company,
          title: job.title,
          url: job.url,
          error: String(e?.message || e)
        });
      }
    } else {
      // No known inbox → needs one-click form submission
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

  saveJson(SEEN_FILE, [...seen].slice(-2500));
  saveJson(APPLY_LOG_FILE, applyLog.slice(-2000));

  // Send daily report to you
  const html = reportHtml(dateStr, results);

  await sendDailyReport({
    to: REPORT_TO,
    subject: `Daily Job Bot — ${dateStr} (Applied: ${results.applied.length}, Needs 1-click: ${results.needsClick.length})`,
    html
  });

  console.log(`Done. Applied=${results.applied.length} NeedsClick=${results.needsClick.length}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
