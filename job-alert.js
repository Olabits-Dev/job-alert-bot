import fs from "fs";
import path from "path";
import { Resend } from "resend";
import { XMLParser } from "fast-xml-parser";
import { SOURCES, KEYWORDS } from "./sources.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Keep Phase-1 to avoid domain verification issues.
// Later you can set your own domain and send to both emails.
const TO_EMAILS = ["atilolasamuel15@gmail.com"]; // add yahoo later if you verify a domain
const FROM = "Job Alerts <onboarding@resend.dev>";

const CACHE_DIR = ".cache";
const SEEN_FILE = path.join(CACHE_DIR, "seen.json");

const xmlParser = new XMLParser({ ignoreAttributes: false });

const norm = (s = "") => String(s).toLowerCase().trim();

function safeArr(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
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
  const arr = [...seenSet].slice(-2500);
  fs.writeFileSync(SEEN_FILE, JSON.stringify(arr, null, 2));
}

function containsAny(text, words) {
  const t = norm(text);
  return words.some((w) => t.includes(norm(w)));
}

function explainMatch(job) {
  const hay = norm(`${job.title} ${job.company} ${job.description || ""} ${(job.tags || []).join(" ")}`);
  const hitsStrong = KEYWORDS.strong.filter(k => hay.includes(norm(k)));
  const hitsWeb3 = KEYWORDS.web3Boost.filter(k => hay.includes(norm(k)));

  const reasons = [];
  if (hitsStrong.length) reasons.push(`Stack match: ${hitsStrong.slice(0, 6).join(", ")}`);
  if (hitsWeb3.length) reasons.push(`Web3/Crypto signals: ${hitsWeb3.slice(0, 6).join(", ")}`);
  if (hay.includes("remote") || hay.includes("worldwide")) reasons.push("Remote-friendly");
  if (hay.includes("contract") || hay.includes("freelance")) reasons.push("Contract mention");

  return reasons.length ? reasons.join(" • ") : "General match";
}

function scoreJob(job) {
  const hay = norm(`${job.title} ${job.company} ${job.description || ""} ${(job.tags || []).join(" ")}`);

  if (containsAny(hay, KEYWORDS.avoid)) return -999;

  let score = 0;

  // Strong skills match
  for (const k of KEYWORDS.strong) {
    if (hay.includes(norm(k))) score += 3;
  }

  // Web3/Crypto boost
  for (const k of KEYWORDS.web3Boost) {
    if (hay.includes(norm(k))) score += 1;
  }

  // Remote boost
  if (hay.includes("remote") || hay.includes("worldwide")) score += 3;

  // Contract boost
  if (hay.includes("contract") || hay.includes("freelance")) score += 2;

  // Prefer “engineer/developer”
  if (hay.includes("engineer") || hay.includes("developer")) score += 1;

  return score;
}

function buildPitch(job) {
  const companyLine = job.company ? `Hi ${job.company} team,` : "Hi,";
  return `${companyLine}

I’m Samuel Atilola — a Frontend & Software Engineer (React, Node.js/Express, PostgreSQL), available immediately for remote contract work.

I’m interested in the "${job.title}" role. Highlights of what I’ve built:
• Responsive React UIs and production-ready web apps
• API backends with Node.js/Express + PostgreSQL
• Automation systems (fintech/crypto-style workflows)

Portfolio: https://olabits-landing-page.onrender.com
GitHub: https://github.com/Olabits-Dev

If you’re open to global remote candidates, I’d love to be considered.

Best regards,
Samuel Atilola
+234 803 520 8600`;
}

async function fetchRemoteOk() {
  const res = await fetch("https://remoteok.com/api", {
    headers: { "User-Agent": "job-alert-bot" }
  });
  if (!res.ok) throw new Error(`RemoteOK fetch failed: ${res.status}`);
  const data = await res.json();

  // First element may be metadata; keep only real jobs
  const jobs = data
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

  return jobs;
}

async function fetchRss(url, sourceName) {
  const res = await fetch(url, { headers: { "User-Agent": "job-alert-bot" } });
  if (!res.ok) throw new Error(`RSS fetch failed (${sourceName}): ${res.status}`);
  const xml = await res.text();

  const parsed = xmlParser.parse(xml);
  const items = parsed?.rss?.channel?.item || [];
  const arr = safeArr(items);

  return arr
    .map((it) => {
      const title = it.title?.["#text"] ?? it.title ?? "Untitled";
      const link =
        it.link?.["@_href"] ||
        it.link ||
        it.guid ||
        "";

      const pubDate = it.pubDate || "";

      return {
        source: sourceName,
        title: String(title),
        company: "",
        url: String(link).trim(),
        date: String(pubDate),
        tags: [],
        description: (it.description?.["#text"] ?? it.description ?? "").toString()
      };
    })
    .filter((j) => j.url && j.title);
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailHtml(dateStr, jobs) {
  const items = jobs.map((j, i) => `
    <div style="padding:14px;border:1px solid #eee;border-radius:12px;margin:12px 0;">
      <div style="font-weight:900;font-size:15px;">
        ${i + 1}. ${escapeHtml(j.title)}
        <span style="font-weight:700;color:#666;font-size:12px;">(Score: ${j.score})</span>
      </div>
      <div style="color:#555;margin-top:6px;">
        <b>Source:</b> ${escapeHtml(j.source)}
        ${j.company ? ` • <b>Company:</b> ${escapeHtml(j.company)}` : ""}
      </div>

      <div style="color:#666;margin-top:6px;">
        <b>Why it matched:</b> ${escapeHtml(j.matchWhy)}
      </div>

      <div style="margin-top:8px;">
        <a href="${j.url}" target="_blank" rel="noreferrer">Apply / View listing</a>
      </div>

      <div style="background:#faf7ff;border:1px solid #eee;border-radius:10px;padding:10px;margin-top:10px;">
        <div style="font-weight:800;margin-bottom:6px;">Paste-ready pitch:</div>
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
      Focus: React/Frontend + Node/Express + PostgreSQL + Web3/Crypto • Remote/Contract
    </p>

    ${jobs.length ? items : `<p>No strong matches today — I’ll keep scanning.</p>`}

    <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />
    <p style="color:#666;font-size:13px;margin:0;">
      Portfolio: <a href="https://olabits-landing-page.onrender.com">olabits-landing-page.onrender.com</a><br/>
      GitHub: <a href="https://github.com/Olabits-Dev">github.com/Olabits-Dev</a>
    </p>
  </div>
  `;
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

  return all;
}

async function main() {
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "short", day: "2-digit"
  });

  const seen = loadSeen();

  const jobs = await collectJobs();

  const ranked = jobs
    .map((j) => ({ ...j, score: scoreJob(j) }))
    .filter((j) => j.score >= 10)           // ✅ threshold: tune if needed
    .filter((j) => !seen.has(j.url))        // ✅ dedupe daily
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)                           // ✅ top 10
    .map((j) => ({
      ...j,
      matchWhy: explainMatch(j),
      pitch: buildPitch(j)
    }));

  // Update seen cache
  ranked.forEach((j) => seen.add(j.url));
  saveSeen(seen);

  const html = emailHtml(dateStr, ranked);

  const { error } = await resend.emails.send({
    from: FROM,
    to: TO_EMAILS,
    subject: `Daily Job Leads — ${dateStr} (Balanced: Software + Web3)`,
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
