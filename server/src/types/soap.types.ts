export type SoapNote = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export function isSoapNote(value: unknown): value is SoapNote {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return ["subjective", "objective", "assessment", "plan"].every(
    (key) => typeof record[key] === "string",
  );
}
