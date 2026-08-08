import { GoogleGenAI } from "@google/genai";

export async function generateSolution({ apiKey, title, contentHtml, langSlug, starterCode }) {
  const prompt = `You are solving a LeetCode problem. Return ONLY the final code, no explanations, no markdown code fences.

Problem title: ${title}

Problem statement (HTML):
${contentHtml}

You must complete this exact starter code/signature for language "${langSlug}":
${starterCode}

Rules:
- Output only valid, complete, compilable/runnable code for langSlug "${langSlug}".
- Keep the given function/class signature intact.
- No comments about your reasoning, no markdown, no backticks.`;

  const ai = new GoogleGenAI({ apiKey });

  let interaction;
  try {
    interaction = await ai.interactions.create({
      model: "gemini-3.6-flash",
      input: prompt,
    });
  } catch (err) {
    throw new Error(`Gemini request failed: ${err.message}`);
  }

  const text = interaction?.output_text;
  if (!text) {
    throw new Error(`No text returned from Gemini: ${JSON.stringify(interaction)}`);
  }

  return stripCodeFences(text.trim());
}

function stripCodeFences(text) {
  return text
    .replace(/^```[a-zA-Z0-9]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}