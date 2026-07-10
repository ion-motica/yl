import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { TextDecoder } from "node:util";

const rootDir = process.cwd();
const strict = process.argv.includes("--strict");
const decoder = new TextDecoder("utf-8", { fatal: true });

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".txt",
]);

const ignoredDirectories = new Set([
  ".agents",
  ".codex",
  ".cursor",
  ".git",
  "node_modules",
]);

const suspiciousSequences = [
  ["moji_I_cap", [0x00c3, 0x017d]],
  ["moji_i_circ", [0x00c3, 0x00ae]],
  ["moji_a_circ", [0x00c3, 0x00a2]],
  ["moji_a_breve", [0x00c4, 0x0192]],
  ["moji_s_comma", [0x00c8, 0x2122]],
  ["moji_t_comma", [0x00c8, 0x203a]],
  ["moji_S_comma", [0x00c8, 0x02dc]],
  ["moji_T_comma", [0x00c8, 0x0161]],
  ["moji_en_dash", [0x00e2, 0x20ac, 0x201c]],
  ["moji_em_dash", [0x00e2, 0x20ac, 0x201d]],
  ["moji_left_quote", [0x00e2, 0x20ac, 0x02dc]],
  ["moji_right_quote", [0x00e2, 0x20ac, 0x2122]],
  ["moji_left_double_quote", [0x00e2, 0x20ac, 0x0153]],
  ["moji_ellipsis", [0x00e2, 0x20ac, 0x00a6]],
];

const suspiciousPatterns = suspiciousSequences.map(([name, codePoints]) => ({
  name,
  text: String.fromCodePoint(...codePoints),
}));

const invalidUtf8 = [];
const suspiciousHits = [];

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!textExtensions.has(path.extname(entry.name))) continue;
    inspectFile(fullPath);
  }
}

function inspectFile(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  const bytes = readFileSync(filePath);
  let text;

  try {
    text = decoder.decode(bytes);
  } catch {
    invalidUtf8.push(relativePath);
    return;
  }

  if (text.includes("\uFFFD")) {
    suspiciousHits.push({
      file: relativePath,
      line: 0,
      type: "replacement_character",
      text: "Contains U+FFFD replacement character.",
    });
  }

  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isIntentionalEncodingNote(line)) return;
    for (const pattern of suspiciousPatterns) {
      if (line.includes(pattern.text)) {
        suspiciousHits.push({
          file: relativePath,
          line: index + 1,
          type: pattern.name,
          text: line.trim().slice(0, 180),
        });
      }
    }
  });
}

function isIntentionalEncodingNote(line) {
  const normalized = line.toLowerCase();
  return normalized.includes("mojibake") || normalized.includes("encoding");
}

walk(rootDir);

if (invalidUtf8.length) {
  console.error("Invalid UTF-8 files:");
  invalidUtf8.forEach((file) => console.error(`- ${file}`));
}

if (suspiciousHits.length) {
  console.warn("Suspicious mojibake-like text:");
  suspiciousHits.forEach((hit) => {
    const location = hit.line > 0 ? `${hit.file}:${hit.line}` : hit.file;
    console.warn(`- ${location} [${hit.type}] ${hit.text}`);
  });
}

if (!invalidUtf8.length && !suspiciousHits.length) {
  console.log("Encoding check OK: UTF-8 valid, no mojibake-like text found.");
}

if (invalidUtf8.length || (strict && suspiciousHits.length)) {
  process.exitCode = 1;
}
