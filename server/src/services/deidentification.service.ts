import type {
  DeidentificationResult,
  PhiCategory,
  PhiContext,
  PhiToken,
  PublicPhiToken,
} from "../types/phi.types";

type TokenCounters = Record<PhiCategory, number>;

const initialCounters: TokenCounters = {
  PATIENT: 0,
  ID: 0,
  CONTACT: 0,
  LOCATION: 0,
  DATE: 0,
  AGE: 0,
  PROVIDER: 0,
  OTHER: 0,
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nextToken(category: PhiCategory, counters: TokenCounters) {
  counters[category] += 1;
  return `${category}_${String(counters[category]).padStart(3, "0")}`;
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s{2,}/g, " ").trim();
}

function toAgeRange(age: number) {
  if (age < 18) {
    return "under 18";
  }

  if (age > 89) {
    return "90+";
  }

  const lower = Math.floor(age / 10) * 10;
  return `${lower}-${lower + 9}`;
}

function addToken(
  tokens: PhiToken[],
  counters: TokenCounters,
  category: PhiCategory,
  originalValue: string,
  source: PhiToken["source"],
  confidence: number,
) {
  const token = nextToken(category, counters);

  tokens.push({
    token,
    originalValue,
    category,
    source,
    confidence,
  });

  return token;
}

function replaceContextValues(
  text: string,
  values: string[] | undefined,
  category: PhiCategory,
  tokens: PhiToken[],
  counters: TokenCounters,
) {
  if (!values?.length) {
    return text;
  }

  let result = text;

  for (const value of [...values].sort((a, b) => b.length - a.length)) {
    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    result = result.replace(new RegExp(escapeRegExp(trimmed), "gi"), (match) =>
      addToken(tokens, counters, category, match, "context", 0.99),
    );
  }

  return result;
}

function replacePattern(
  text: string,
  pattern: RegExp,
  category: PhiCategory,
  tokens: PhiToken[],
  counters: TokenCounters,
  confidence = 0.9,
) {
  return text.replace(pattern, (match) =>
    addToken(tokens, counters, category, match, "pattern", confidence),
  );
}

function replaceAges(text: string, tokens: PhiToken[], counters: TokenCounters) {
  return text
    .replace(
      /\b(?:age|aged)\s*[:is]?\s*(\d{1,3})\b/gi,
      (match, ageValue: string) => {
        const age = Number(ageValue);
        const range = Number.isFinite(age) ? toAgeRange(age) : "AGE_RANGE";
        const token = addToken(tokens, counters, "AGE", match, "pattern", 0.9);
        return `${token} (${range})`;
      },
    )
    .replace(
      /\b(\d{1,3})\s*(?:years?\s*old|y\.?o\.?)\b/gi,
      (match, ageValue: string) => {
        const age = Number(ageValue);
        const range = Number.isFinite(age) ? toAgeRange(age) : "AGE_RANGE";
        const token = addToken(tokens, counters, "AGE", match, "pattern", 0.9);
        return `${token} (${range})`;
      },
    );
}

export function deidentifyTranscript(
  text: string,
  context: PhiContext = {},
): DeidentificationResult {
  const tokens: PhiToken[] = [];
  const counters: TokenCounters = { ...initialCounters };
  let deidentifiedText = text;

  deidentifiedText = replaceContextValues(
    deidentifiedText,
    context.names,
    "PATIENT",
    tokens,
    counters,
  );
  deidentifiedText = replaceContextValues(
    deidentifiedText,
    context.ids,
    "ID",
    tokens,
    counters,
  );
  deidentifiedText = replaceContextValues(
    deidentifiedText,
    context.contacts,
    "CONTACT",
    tokens,
    counters,
  );
  deidentifiedText = replaceContextValues(
    deidentifiedText,
    context.locations,
    "LOCATION",
    tokens,
    counters,
  );
  deidentifiedText = replaceContextValues(
    deidentifiedText,
    context.ages,
    "AGE",
    tokens,
    counters,
  );
  deidentifiedText = replaceContextValues(
    deidentifiedText,
    context.providers,
    "PROVIDER",
    tokens,
    counters,
  );

  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    "CONTACT",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    "CONTACT",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b(?:MRN|MR#|medical record(?: number)?|patient id|member id|id number|account number)\s*[:#-]?\s*[\w-]+\b/gi,
    "ID",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b[A-Z]{2,}-\d+\b/g,
    "ID",
    tokens,
    counters,
    0.85,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b\d+\s+[A-Za-z0-9.\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct|parkway|pkwy)\b/gi,
    "LOCATION",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b(?:lives at|address is|located at|from)\s+[A-Za-z0-9.\s,]+/gi,
    "LOCATION",
    tokens,
    counters,
    0.8,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b(?:Mr|Mrs|Ms|Miss)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    "PATIENT",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\bDr\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    "PROVIDER",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b(?:patient|name is|called)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g,
    "PATIENT",
    tokens,
    counters,
    0.8,
  );
  deidentifiedText = replaceAges(deidentifiedText, tokens, counters);
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    "DATE",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    "DATE",
    tokens,
    counters,
  );
  deidentifiedText = replacePattern(
    deidentifiedText,
    /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,\s*\d{4})?\b/gi,
    "DATE",
    tokens,
    counters,
  );

  return {
    deidentifiedText: normalizeWhitespace(deidentifiedText),
    tokens,
  };
}

export function toPublicPhiTokens(tokens: PhiToken[]): PublicPhiToken[] {
  return tokens.map(({ originalValue: _originalValue, ...token }) => token);
}

export function reinjectPhiTokens(text: string, tokens: PhiToken[]) {
  return tokens.reduce(
    (result, token) =>
      result.replace(new RegExp(`\\b${escapeRegExp(token.token)}\\b`, "g"), token.originalValue),
    text,
  );
}
