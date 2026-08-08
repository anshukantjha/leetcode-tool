#!/usr/bin/env node
// index.js — CLI entrypoint. Wires together:

import { Command } from 'commander';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

import { loadAuth } from './auth-store.js';
import {
  getQuestionBySlug,
  getDailyQuestion,
  submitSolution,
  checkSubmission,
} from './leetcodeClient.js';
import { generateSolution } from './geminiClient.js';
import { requireGeminiKey, getGeminiKey } from './gemini-key.js'
import { getLangSlug } from './slugs.js'

function slugify(titleOrSlug) {
  return titleOrSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const program = new Command();

program
  .name('leetcode-tool')
  .description('Automate fetching, solving (via Gemini), and submitting LeetCode problems')
  .version('0.1.0');

// for authorization via spinning a browser
program
  .command('auth')
  .description('Open a browser to log into LeetCode and capture session cookies')
  .action(() => {
    const child = spawn('node', [path.join(__dirname, 'auth.js')], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  });


const config = program.command('config').description('Manage stored configuration');

config
  .command('status')
  .description('Show what is currently configured (never prints secrets)')
  .action(() => {
    let authOk = false;
    try {
      loadAuth();
      authOk = true;
    } catch {
      authOk = false;
    }
    console.log(`LeetCode auth:   ${authOk ? 'present' : 'missing — run "leetcode-tool auth"'}`);
    console.log(`Gemini API key:  ${getGeminiKey() ? 'present' : 'missing — see the readme for more '}`);
  });

program
  .command('question <slug>')
  .description('Fetch a LeetCode question by its slug (e.g. two-sum)')
  .action(async (slug) => {
    const auth = loadAuth();
    const question = await getQuestionBySlug(slug, auth);
    console.log(JSON.stringify(question, null, 2));
  });

program
  .command('daily')
  .description("Fetch today's LeetCode daily challenge")
  .option('-g, --generate', 'also generate a solution with Gemini')
  .option('-s, --submit', 'also submit the generated solution (implies --generate)')
  .option('-l, --lang <language>', 'language to generate/submit', 'python3')
  .action(async (opts) => {
    const auth = loadAuth();
    const question = await getDailyQuestion(auth);
    console.log(`Today's question: ${question.title} (${question.titleSlug})`);

    if (opts.generate || opts.submit) {
      await generateAndMaybeSubmit(question, auth, opts);
    } else {
      console.log(JSON.stringify(question, null, 2));
    }
  });

// ---------------------------------------------------------------------
// solve <slug> — generate (and optionally submit) a solution for a
// specific problem, not just the daily one
// ---------------------------------------------------------------------
program
  .command('solve <slug>')
  .description('Generate a Gemini solution for a question, optionally submit it')
  .option('-s, --submit', 'submit the generated solution instead of just printing it')
  .option('-l, --lang <language>', 'language to generate/submit', 'python3')
  .action(async (slug, opts) => {
    const auth = loadAuth();
    const question = await getQuestionBySlug(slug);
    await generateAndMaybeSubmit(question, auth, { generate: true, submit: opts.submit, lang: opts.lang });
  });

// ---------------------------------------------------------------------
// submit <slug> --file <path> — submit code you already have
// ---------------------------------------------------------------------
program
  .command('submit <slug>')
  .description('Submit an existing solution file for a question')
  .requiredOption('-f, --file <path>', 'path to the solution file')
  .option('-l, --lang <language>', 'language of the solution', 'python3')
  .action(async (slug, opts) => {
    const titleSlug = slugify(slug);
    const auth = loadAuth();
    const code = fs.readFileSync(opts.file, 'utf-8');
    const question = await getQuestionBySlug(titleSlug);
    const result = await submitSolution({
      session: auth.leetcodeSession,
      csrfToken: auth.csrfToken,
      titleSlug: question.titleSlug,
      questionId: question.questionId,
      lang: opts.lang,
      langSlug: getLangSlug(opts.lang),
      code
    });

    console.log(`Submitted. submissionId=${result}`);
    console.log('Run: leetcode-tool status', result, '  to check the verdict.');
  });

// ---------------------------------------------------------------------
// status <submissionId> — poll a submission's verdict
// ---------------------------------------------------------------------
program
  .command('status <submissionId>')
  .description('Check the verdict of a submission')
  .action(async (submissionId) => {
    const auth = loadAuth();
    const result = await checkSubmission({
      session: auth.leetcodeSession,
      csrfToken: auth.csrfToken,
      submissionId
    });
    console.log(JSON.stringify(result, null, 2));
  });

// ---------------------------------------------------------------------
// shared helper: generate via Gemini, print, optionally submit + poll
// ---------------------------------------------------------------------
async function generateAndMaybeSubmit(question, auth, opts) {
  const geminiKey = requireGeminiKey();
  console.log(`Generating a ${opts.lang} solution with Gemini...`);


  const langSlug = getLangSlug(opts.lang);

  const snippet = question.codeSnippets.find((s) => s.langSlug === langSlug);
  if (!snippet) {
    const available = question.codeSnippets.map((s) => s.langSlug).join(", ");
    throw new Error(
      `No starter code for langSlug "${langSlug}". Available: ${available}`
    );
  }

  const code = await generateSolution({
    apiKey: geminiKey,
    title: question.titleSlug,
    contentHtml: question.content,
    langSlug,
    starterCode: snippet.code
  });

  console.log('\n--- Generated solution ---\n');
  console.log(code);
  console.log('\n---------------------------\n');

  if (!opts.submit) return;

  console.log('Submitting...');
  const result = await submitSolution({
    session: auth.leetcodeSession,
    csrfToken: auth.csrfToken,
    titleSlug: question.titleSlug,
    questionId: question.questionId,
    lang: opts.lang,
    langSlug: getLangSlug(opts.lang),
    code
  });

  console.log(result);
  console.log(`Submitted. submissionId=${result}`);

  console.log('Polling for verdict...');
  const verdict = await checkSubmission({
    session: auth.leetcodeSession,
    csrfToken: auth.csrfToken,
    submissionId: result
  });
  console.log(JSON.stringify(verdict, null, 2));
}


program.parseAsync(process.argv).catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});