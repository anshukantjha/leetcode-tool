// auth-store.js
//
// Shared read-only accessor for the credentials auth.js saves.
// The submission engine / Gemini modules import this instead of
// touching Playwright or the filesystem paths directly.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const AUTH_FILE = path.join(os.homedir(), '.config', 'leetcode-tool', 'auth.json');

export function loadAuth() {
  if (!fs.existsSync(AUTH_FILE)) {
    throw new Error(
      "No saved LeetCode credentials found. Run 'leetcode-tool auth' (or 'node auth.js') first."
    );
  }
  const raw = fs.readFileSync(AUTH_FILE, 'utf-8');
  const auth = JSON.parse(raw);

  if (auth.sessionExpiresAt && Date.now() > auth.sessionExpiresAt) {
    console.warn(
      'Warning: your saved LeetCode session looks expired. ' +
      "If submissions start failing with auth errors, re-run 'leetcode-tool auth'."
    );
  }

  return auth; // { csrfToken, leetcodeSession, sessionExpiresAt, capturedAt }
}