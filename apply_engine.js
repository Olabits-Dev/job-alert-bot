// apply_engine.js
import fs from "fs";
import path from "path";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_NAME = "Samuel Olawale Atilola";
export const REPLY_TO = "atilolasamuel15@gmail.com"; // your chosen sender email (A)

const CV_PATH = path.join("assets", "cv.pdf");

export function loadCvAttachment() {
  if (!fs.existsSync(CV_PATH)) {
    throw new Error(`CV not found at ${CV_PATH}. Create assets/cv.pdf in the repo.`);
  }

  const content = fs.readFileSync(CV_PATH).toString("base64");
  return {
    filename: "Samuel_Olawale_Atilola_CV.pdf",
    content
  };
}

/**
 * Sends an application email to a company/recruiter inbox (only when provided).
 */
export async function sendApplicationEmail({ to, subject, html }) {
  const attachment = loadCvAttachment();

  const { error } = await resend.emails.send({
    // Phase-1 sender (no domain needed)
    from: `${FROM_NAME} <onboarding@resend.dev>`,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
    attachments: [attachment]
  });

  if (error) throw new Error(JSON.stringify(error));
}

/**
 * Sends you the daily summary/status report.
 */
export async function sendDailyReport({ to, subject, html }) {
  const { error } = await resend.emails.send({
    from: `Job Bot <onboarding@resend.dev>`,
    to: [to],
    subject,
    html
  });

  if (error) throw new Error(JSON.stringify(error));
}
