import fs from "fs";
import path from "path";
import { Resend } from "resend";
import { XMLParser } from "fast-xml-parser";
import { SOURCES, KEYWORDS } from "./sources.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Phase 1: send to one email (same one you used for Resend signup)
const TO_EMAILS = ["atilolasamuel15@gmail.com"];
// After domain verification you can do:
// const TO_EMAILS = ["atilolasamuel15@gmail.com", "atilola33@yahoo.com"];

const CACHE_DIR = ".cache";
const SEEN_FILE = path.join(CACHE_DIR, "seen.json");

// GitHub Actions runner uses Node 18+ so fetch is available
const xmlParser = new XMLParser({ ignoreAttributes: false });

function norm(s = "") {
  return String(s).toLowerCase().trim();
}

function containsAny(text, words) {
  const t = norm(text);
  return words.some(w => t.includes(norm(w)));
}

function scoreJob(job) {
  const hay = `${job.title} ${job.company} ${job.description ?? ""} ${job.tags?.join(" ") ?? ""}`;
  const t = norm(hay);

  if (containsAny(t, KEYWORDS.avoid)) return -999;

  let score = 0;

  // Strong matches
  KEYWORDS.strong.forEach(k => { if (t.includes(k)) score += 3; });

  // Web3 boost
  KEYWORDS.web3Boost.forEach(k => { if (t.includes(k)) score += 1; });

  // Remote boost
  if (t.includes("remote") || t.includes("worldwide")) score += 2;

  // Contract boost
  if (t.includes("contract") || t.includes("freelance")) score += 1;

  return score;
}

function loadSeen() {
  try {
    if (!fs.existsSync(SEEN_FILE)) return new Set();
    const raw = fs.readFileSync(SEEN_FILE, "utf8");
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(seenSet) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(SEEN_FILE, JSON.stringify([...seenSet].slice(-2000), null, 2));
}

async function fetchRemoteOk() {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "job-alert-bot" }
  });
  if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);
  const data = await res.json();

  // RemoteOK API returns the first item as metadata; filter real jobs
  const jobs = data
    .filter(x => x && x.id && x.position)
    .map(x => ({
      source: "RemoteOK",
      title: x.position,
      company: x.company,
      url: x.url || x.apply_url || `https://remoteok.com/remote-jobs/${x.id}`,
      date: x.date || x.epoch ? new Date((x.epoch || 0) * 1000).toISOString() : "",
      tags: x.tags || [],
      description: x.description || ""
    }));

  return jobs;
}

async function fetchRss(url, sourceName) {
  const res = await fetch(url, { headers: { "User-Agent": "job-alert-bot" } });
  if (!res.ok) throw new Error(`RSS fetch failed (${sourceName}): ${res.status}`);
  const xml = await res.text();

  const parsed = xmlParser.parse(xml);
  const items =
    parsed?.rss?.channel?.item ||
    parsed?.feed?.entry ||
    [];

  const arr = Array.isArray(items) ? items : [items];

  return arr.map(it => {
    const title = it.title?.["#text"] ?? it.title ?? "Untitled";
    const link =
      it.link?.["@_href"] ||
      it.link ||
      it.guid ||
      "";

    const pubDate = it.pubDate || it.published || it.updated || "";

    return {
      source: sourceName,
      title,
      company: "", // some RSS feeds don’t include company cleanly
      url: String(link),
      date: String(pubDate),
      tags: [],
      description: (it.description?.["#text"] ?? it.description ?? it.summary ?? "").toString()
    };
  }).filter(j => j.url);
}

function buildPitch(job) {
  const companyLine = job.company ? `Hi ${job.company} team,` : "Hi,";
  return `${companyLine}

I’m Samuel Atilola — a Frontend & Software Engineer (React, Node.js/Express, PostgreSQL), available immediately for remote contract work.

I’m interested in the "${job.title}" role. I’ve built:
• SaaS dashboards and responsive UI using React/HTML/CSS/JavaScript
• API-driven backends with Node.js/Express and PostgreSQL
• Automation systems (fintech/crypto-style workflows)

Portfolio: https://olabits-landing-page.onrender.com
GitHub: https://github.com/Olabits-Dev

If this role is open to global remote candidates, I’d love to be considered.

Best regards,
Samuel Atilola
+234 803 520 8600`;
}

function emailHtml(dateStr, jobs) {
  const list = jobs.map((j, i) => `
    <div style="padding:14px;border:1px solid #eee;border-radius:12px;margin:12px 0;">
      <div style="font-weight:800;">${i + 1}. ${escapeHtml(j.title)}</div>
      <div style="color:#555;margin-top:6px;">
        <b>Source:</b> ${escapeHtml(j.source)}
        ${j.company ? ` • <b>Company:</b> ${escapeHtml(j.company)}` : ""}
      </div>
      <div style="margin-top:8px;">
        <a href="${j.url}" target="_blank" rel="noreferrer">Apply / View listing</a>
      </div>
      <div style="background:#faf7ff;border:1px solid #eee;border-radius:10px;padding:10px;margin-top:10px;">
        <div style="font-weight:700;margin-bottom:6px;">Paste-ready pitch:</div>
        <div style="white-space:pre-wrap;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.6;">
${escapeHtml(j.pitch)}
        </div>
      </div>
    </div>
  `).join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:820px;margin:auto;padding:18px;">
    <h2 style="margin:0 0 10px;">Daily Job Leads — ${dateStr}</h2>
    <p style="color:#555;margin:0 0 14px;">
      Filters: React / Frontend / Software Engineer + Node/Express + PostgreSQL + Web3/Crypto • Remote
    </p>

    ${jobs.length ? list : `<p>No strong matches today — I’ll keep scanning.</p>`}

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="color:#666;font-size:13px;margin:0;">
      Portfolio: <a href="https://olabits-landing-page.onrender.com">olabits-landing-page.onrender.com</a><br/>
      GitHub: <a href="https://github.com/Olabits-Dev">github.com/Olabits-Dev</a>
    </p>
  </div>
  `;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function collectJobs() {
  const all = [];

  for (const src of SOURCES) {
    try {
      if (src.type === "json" && src.url.includes("remoteok.com/api")) {
        all.push(...await fetchRemoteOk());
      } else if (src.type === "rss") {
        all.push(...await fetchRss(src.url, src.name));
      }
    } catch (e) {
      console.error(`Source failed: ${src.name}`, e?.message || e);
    }
  }

  // Clean URLs
  return all
    .filter(j => j.url && j.title)
    .map(j => ({ ...j, url: j.url.trim() }));
}

async function main() {
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "2-digit"
  });

  const seen = loadSeen();

  const jobs = await collectJobs();

  // Filter + score
  const ranked = jobs
    .map(j => ({ ...j, score: scoreJob(j) }))
    .filter(j => j.score > 3) // threshold (tune it)
    .filter(j => !seen.has(j.url))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(j => ({ ...j, pitch: buildPitch(j) }));

  // Mark as seen
  ranked.forEach(j => seen.add(j.url));
  saveSeen(seen);

  const html = emailHtml(dateStr, ranked);

  const { error } = await resend.emails.send({
    from: "Job Alerts <onboarding@resend.dev>",
    to: TO_EMAILS,
    subject: `Daily Job Leads — ${dateStr} (Remote + Web3/Crypto)`,
    html
  });

  if (error) {
    console.error("Resend error:", error);
    process.exit(1);
  }

  console.log(`Sent ${ranked.length} jobs. Seen cache size: ${seen.size}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
