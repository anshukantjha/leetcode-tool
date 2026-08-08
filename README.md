# leetcode-tool
A cli that fetches LeetCode problems, generates solutions with Gemini, and
submits them to your LeetCode account.

## Requirements

- Node.js 18+ 
- A Gemini API key ([aistudio.google.com](https://aistudio.google.com/apikey))
- A LeetCode account

## Installation

### Option A — install the `.deb` package (Debian/Ubuntu)

```bash
sudo dpkg -i ./leetcode-tool_<version>_all.deb
```

This installs the tool to `/usr/lib/leetcode-tool` with a `leetcode-tool`
launcher on your `PATH` (`/usr/bin/leetcode-tool`). Verify it worked:

```bash
leetcode-tool --version
```

### Option B — run from source

```bash
git clone github.com/anshukantjha/leetcode-tool
cd leetcode-tool
npm install
node index.js --help
```

To make it runnable as `leetcode-tool` from source without packaging:

```bash
alias leetcode-tool="node /path/to/leetcode-tool/index.js"
```

## Setup

The tool needs two things configured before it can generate or submit
solutions: a Gemini API key, and a logged-in LeetCode session (csrf and leetcodesession).

### 1. Gemini API key

Set it as an environment variable:

```bash
export GEMINI_API_KEY=your_key_here
```

Add that line to `~/.bashrc` or `~/.zshrc` so it persists across terminal
sessions:

```bash
echo 'export GEMINI_API_KEY=your_key_here' >> ~/.bashrc
source ~/.bashrc
```

> Check `gemini-key.js` in the source if you want to confirm the exact
> assumes the same `GEMINI_API_KEY` convention used elsewhere in the project.

### 2. LeetCode authentication

Run:

```bash
leetcode-tool auth
```

This opens a browser window (via Playwright library) where you log into LeetCode
normally. Once logged in, the tool captures your session cookie and CSRF
token and stores them locally for future commands — you shouldn't need to
run this again unless your session expires or you log out.

> Check `auth-store.js` for exactly where credentials are stored on disk
> (e.g. `~/.config/leetcode-tool/`) if you need to back them up, inspect
> them, or delete them to force a fresh login.

### 3. Verify setup

```bash
leetcode-tool config status
```

Prints whether LeetCode auth and the Gemini key are present — it never
prints the actual secrets, just presence/absence.

## Commands

Run `leetcode-tool --help` to see this list at any time, and
`leetcode-tool <command> --help` for a command's own options.

## Typical workflows

**Solve and submit today's daily challenge:**
```bash
leetcode-tool daily --submit
```

**Look at a problem before deciding on a language:**
```bash
leetcode-tool question two-sum | less
leetcode-tool solve two-sum --lang javascript --submit
```

**Write your own solution and just use the tool to submit it:**
```bash
leetcode-tool submit two-sum --file solution.py
leetcode-tool status <submissionId-from-above>
```

## Supported languages

The `--lang` flag accepts a human-readable name (e.g. `python3`, `cpp`,
`javascript`, `java`) which is mapped internally to LeetCode's `langSlug`
values.

> Check `slugs.js` for the full supported list and exact accepted spellings
> — if you pass a language that isn't mapped there, `solve`/`daily
> --generate`/`submit` will fail with a "No starter code for langSlug ..."
> error listing what *is* available for that specific problem.

## Troubleshooting

**`leetcode-tool: command not found`**
Confirm the binary is on your `PATH`: `which leetcode-tool`. If installed
via `.deb`, check `dpkg -L leetcode-tool` lists `/usr/bin/leetcode-tool`,
and that it's executable (`ls -la /usr/bin/leetcode-tool`).

**`Error: Gemini API key missing` (or similar, from `requireGeminiKey`)**
Run `leetcode-tool config status` to confirm, then re-check the
`GEMINI_API_KEY` export in your current shell (`echo $GEMINI_API_KEY`).

**Auth errors on `solve --submit` / `submit` / `status`**
Your stored LeetCode session likely expired. Re-run `leetcode-tool auth` to
log in again.

**`No starter code for langSlug "..."` error**
Run `leetcode-tool question <slug>` and check the `codeSnippets` array in
the output for exactly which `langSlug` values that specific problem
supports — not every problem supports every language.
