# Integral Christianity Bluesky bots + landing page

This repo ships two things:

1) **7 Bluesky bots** (Miracle → Holistic) that post hourly at **:20** and only reply when they’re explicitly tagged (opt‑in).
2) A **simple, beautiful landing page** that shows the latest posts from each bot.

---

## Part A — Bots (runs free on GitHub Actions)

### 1) Create Bluesky accounts
Create one Bluesky account per persona:
- Ruth (Miracle)
- Bryce (Warrior)
- Jerry (Traditional)
- Raymond (Modern)
- Parker (Postmodern)
- Kenny (Integral)
- Andrea (Holistic)

### 2) Create app passwords
In each account: **Settings → App passwords → Add app password**.
Copy the password (you’ll use it in GitHub Secrets).

### 3) Create a GitHub repo + add secrets
Create a GitHub repo and push this code.

In your repo: **Settings → Secrets and variables → Actions → New repository secret**.

Add:
- `BSKY_RUTH_HANDLE`, `BSKY_RUTH_APP_PASSWORD`
- `BSKY_BRYCE_HANDLE`, `BSKY_BRYCE_APP_PASSWORD`
- `BSKY_JERRY_HANDLE`, `BSKY_JERRY_APP_PASSWORD`
- `BSKY_RAYMOND_HANDLE`, `BSKY_RAYMOND_APP_PASSWORD`
- `BSKY_PARKER_HANDLE`, `BSKY_PARKER_APP_PASSWORD`
- `BSKY_KENNY_HANDLE`, `BSKY_KENNY_APP_PASSWORD`
- `BSKY_ANDREA_HANDLE`, `BSKY_ANDREA_APP_PASSWORD`

`OPENAI_API_KEY` and `OPENAI_MODEL`.

### 4) Turn on Actions
Go to **Actions**, enable workflows.
Run the workflow once using **Run workflow**.

It will also run automatically hourly at **:20**.

---

## Part B — Landing page (deploy free on Netlify)

### Deploy
- Create a Netlify project pointing at `/web`
- Add one env var: `NEXT_PUBLIC_BOT_HANDLES` (comma-separated handles, no @)
  Example:
  `ruth.bot.bsky.social,bryce.bot.bsky.social,...`

Then deploy.

---

## Local dev

### Bots
```bash
cd bots
npm i
cp src/config.local.example.json src/config.local.json
# fill in handles + app passwords (DON'T COMMIT)
npm run run:hourly
```

### Web
```bash
cd web
npm i
npm run dev
```

---

## Safety + etiquette
Bluesky bot guidance recommends **only interacting if the user tagged the bot** (opt‑in). This repo follows that by only replying to mentions/replies.
