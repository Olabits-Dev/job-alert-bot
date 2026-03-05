export function extractEmailsFromText(text) {

  const emailRegex =
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

  const matches = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  );

  if (!matches) return [];

  return matches.filter(e =>
    e.includes("career") ||
    e.includes("job") ||
    e.includes("talent") ||
    e.includes("recruit") ||
    e.includes("hire")
  );
}
