const LANGUAGE_SLUGS = {
  python: 'python3',
  python3: 'python3',
  java: 'java',
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  cpp: 'cpp',
  'c++': 'cpp',
  c: 'c',
  csharp: 'csharp',
  'c#': 'csharp',
  go: 'golang',
  rust: 'rust',
  kotlin: 'kotlin',
  swift: 'swift',
};

export function getLangSlug(language) {
  const normalized = language.trim().toLowerCase();

  const slug = LANGUAGE_SLUGS[normalized];

  if (!slug) {
    throw new Error(
      `Unsupported language "${language}". Supported languages: ${Object.keys(LANGUAGE_SLUGS).join(', ')}`
    );
  }

  return slug;
}