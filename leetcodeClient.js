

const BASE = "https://leetcode.com";

function authHeaders(session, csrfToken) {
  return {
    "Content-Type": "application/json",
    Cookie: `LEETCODE_SESSION=${session}; csrftoken=${csrfToken};`,
    "x-csrftoken": csrfToken,
    Referer: BASE,
    Origin: BASE,
  };
}


export async function getQuestionBySlug(titleSlug) {
  const query = `
    query getQuestion($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        questionId
        questionFrontendId
        title
        titleSlug
        content
        difficulty
        codeSnippets {
          lang
          langSlug
          code
        }
      }
    }
  `;

  const res = await fetch(`${BASE}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: BASE },
    body: JSON.stringify({ query, variables: { titleSlug } }),
  });

  if (!res.ok) {
    throw new Error(`LeetCode question fetch failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const question = json?.data?.question;
  if (!question) {
    throw new Error(`No question found for slug "${titleSlug}"`);
  }
  return question;
}

export async function getDailyQuestion() {
  const query = `query {
  activeDailyCodingChallengeQuestion {
    date
    link
    question {
        questionId
        questionFrontendId
        title
        titleSlug
        content
        difficulty
        codeSnippets {
          lang
          langSlug
          code
        }
    }
  }
}`;

  const res = await fetch(`${BASE}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: BASE },
    body: JSON.stringify({ query }),
  });

 if (!res.ok) {
    throw new Error(`LeetCode question fetch failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const question = json?.data?.activeDailyCodingChallengeQuestion?.question;
  if (!question) {
    throw new Error(`No question found for today"`);
  }
  return question;
}


export async function submitSolution({ session, csrfToken, titleSlug, questionId, lang, langSlug, code }) {
  const res = await fetch(`${BASE}/problems/${titleSlug}/submit/`, {
    method: "POST",
    headers: authHeaders(session, csrfToken),
    body: JSON.stringify({
      lang: langSlug,
      question_id: questionId,
      typed_code: code,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Submission request failed: ${res.status} ${res.statusText} ${text}`);
  }

  const json = await res.json();
  if (!json.submission_id) {
    throw new Error(`No submission_id returned: ${JSON.stringify(json)}`);
  }
  return json.submission_id;
}

export async function checkSubmission({ session, csrfToken, submissionId, timeoutMs = 30000, intervalMs = 1500 }) {
  const url = `${BASE}/submissions/detail/${submissionId}/check/`;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const res = await fetch(url, { headers: authHeaders(session, csrfToken) });
    const json = await res.json();

    if (json.state === "SUCCESS") {
      return json;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("Timed out waiting for submission result");
}
