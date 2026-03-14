# AI Job Hunter Bot (GitHub Actions + Resend)

- ✅ Multi-profile support (developer + customer support job seekers)

A serverless job discovery + application assistant that runs daily using GitHub Actions.

7. Switches candidate profile using `PROFILE=dev` or `PROFILE=precious_support`

It scans:
- Remote job boards (RemoteOK, RSS feeds)
- Startup ATS boards (Greenhouse, Lever, Ashby)

Then it filters + ranks jobs for:
**React / Node.js / TypeScript / PostgreSQL + Web3/Crypto**  
and sends a daily email report.

## Features
- ✅ Daily scheduled runs (GitHub Actions cron)
- ✅ Job scoring + dedupe cache
- ✅ Startup board scanning (Greenhouse, Lever, Ashby)
- ✅ Recruiter email discovery (public emails only)
- ✅ Optional auto-apply by email (with CV attachment)
- ✅ Daily summary: Applied ✅ / Needs 1-click ⏳ / Skipped ❌

## How it works
1. Collect jobs from multiple sources  
2. Score jobs based on keyword matching  
3. Skip duplicates using a cache  
4. Discover recruiter emails from public job pages  
5. Send applications by email when possible  
6. Email you a daily report

## Setup
### 1) Create Resend API key
Create a key in Resend and add it to GitHub Secrets.

### 2) Add GitHub Secrets
- `RESEND_API_KEY`
- `REPORT_TO`
- `REPLY_TO`
- `FROM_NAME`

Optional:
- `CV_PATH` (defaults to `assets/cv.pdf`)

### 3) Add CV file (private)
Place your CV at: `assets/cv.pdf`

> This file is ignored by `.gitignore` and should NOT be committed publicly.

### 4) Run
- Manual: GitHub → Actions → Run workflow
- Scheduled: runs daily via cron

## Screenshot
![Daily Report](docs/screenshots/daily-report.png)

## Safety
- No login automation
- No form auto-submission
- Only uses public job feeds + public emails on pages
- Secrets stored in GitHub Actions Secrets

## Author
Samuel Olawale Atilola  
Portfolio: https://olabits-landing-page.onrender.com  
GitHub: https://github.com/Olabits-Dev  
LinkedIn: https://www.linkedin.com/in/samuel-atilola-a78994251
