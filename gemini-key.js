// gemini-key.js

export function getGeminiKey() {
  return process.env.GEMINI_API_KEY || null;
}

export function requireGeminiKey() {
  const key = getGeminiKey();
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY not set. Run:\n" +
      '  export GEMINI_API_KEY="your-key-here"\n' +
      "Add that line to your ~/.bashrc or ~/.zshrc to make it permanent."
    );
  }
  return key;
}