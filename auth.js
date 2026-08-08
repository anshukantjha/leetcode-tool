// auth.js
// launches a real persistent firefox browser which saves csrf and cookie 
// Once the login cookies appear, we extract csrfToken + LEETCODE_SESSION
// and write them to a config file that the rest of the CLI can read.
// Run with: node auth.js
// Re-run any time your session expires (LEETCODE_SESSION cookies do expire).

import { firefox } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'leetcode-tool');
const PROFILE_DIR = path.join(CONFIG_DIR, 'firefox-profile');
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json');

const LOGIN_URL = 'https://leetcode.com/accounts/login/';
const POLL_INTERVAL_MS = 1500;
const TIMEOUT_MS = 5 * 60 * 1000; // give the user up to 5 minutes to log in

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
}

function extractAuthCookies(cookies) {
  const csrf = cookies.find((c) => c.name === 'csrftoken');
  const session = cookies.find((c) => c.name === 'LEETCODE_SESSION');
  if (!csrf || !session) return null;
  return {
    csrfToken: csrf.value,
    leetcodeSession: session.value,
    // csrftoken cookies on leetcode are long-lived; session cookies
    // typically carry their own 'expires' — store it so we can warn
    // the user later if it's gone stale.
    sessionExpiresAt: session.expires && session.expires > 0
      ? Math.floor(session.expires * 1000)
      : null,
    capturedAt: Date.now(),
  };
}

function saveAuth(authData) {
  ensureConfigDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), {
    mode: 0o600, // owner read/write only — this is a session token
  });
  console.log(`\nSaved credentials to ${AUTH_FILE}`);
}


const WARM_UP_SITES = [
  'https://en.wikipedia.org/wiki/Special:Random',
  'https://news.ycombinator.com',
  'https://anshujha.in'
];

async function humanishScroll(page) {
  const steps = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < steps; i++) {
    await page.mouse.move(
      100 + Math.random() * 800,
      100 + Math.random() * 500
    );
    await page.mouse.wheel(0, 200 + Math.random() * 400);
    await page.waitForTimeout(300 + Math.random() * 500);
  }
}

async function warmProfile(context) {
  console.log('Warming up browser profile before login (first run only)...');
  const page = await context.newPage();
  for (const url of WARM_UP_SITES) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await humanishScroll(page);
    } catch {
      // A single warm-up site failing (network blip, layout change) isn't
      // worth aborting the whole flow over — just move on.
      console.log(`  (skipped ${url}, continuing)`);
    }
  }
  await page.close();
}

async function main() {
  ensureConfigDir();
  const isFirstRun = !fs.existsSync(PROFILE_DIR);

  console.log('Launching Firefox — please log into LeetCode in the window that opens.');
  console.log('(This browser profile persists, so you should only need to do this once');
  console.log(' until your session naturally expires.)\n');

  // Persistent context = the profile (and its cookies) survive between runs.
  const context = await firefox.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata', 
    firefoxUserPrefs: {
      'dom.webdriver.enabled': false,
      'privacy.trackingprotection.enabled': false,
    },
    args: [], 
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  if (isFirstRun) {
    await warmProfile(context);
  }

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(LOGIN_URL);

  const deadline = Date.now() + TIMEOUT_MS;
  let authData = null;

  console.log('Waiting for login to complete...');

  while (Date.now() < deadline) {
    const cookies = await context.cookies('https://leetcode.com');
    authData = extractAuthCookies(cookies);
    if (authData) break;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  if (!authData) {
    console.error('\nTimed out waiting for login. No cookies captured — nothing was saved.');
    await context.close();
    process.exit(1);
  }

  saveAuth(authData);
  console.log('Login detected. You can close the browser window now.');
  console.log('Leaving it open for a few seconds in case LeetCode needs to finish redirecting...');

  await new Promise((r) => setTimeout(r, 3000));
  await context.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Auth flow failed:', err);
  process.exit(1);
});