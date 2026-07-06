export type PhiCategory =
  | "PATIENT"
  | "ID"
  | "CONTACT"
  | "LOCATION"
  | "DATE"
  | "AGE"
  | "PROVIDER"
  | "OTHER";

export type PhiContext = {
  names?: string[];
  ids?: string[];
  contacts?: string[];
  locations?: string[];
  ages?: string[];
  providers?: string[];
};

export type PhiToken = {
  token: string;
  originalValue: string;
  category: PhiCategory;
  source: "context" | "pattern";
  confidence: number;
};

export type PublicPhiToken = Omit<PhiToken, "originalValue">;

export type DeidentificationResult = {
  deidentifiedText: string;
  tokens: PhiToken[];
};
