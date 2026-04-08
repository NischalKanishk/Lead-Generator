export const CLIENT_TYPES = [1, 2, 3] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  1: "Offsite",
  2: "Corporate Travel",
  3: "Education",
};

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "replied",
  "qualified",
  "unqualified",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  qualified: "Qualified",
  unqualified: "Unqualified",
};

/** Matches POST /api/generate */
export type GenerateApiType =
  | "initial"
  | "follow_up_1"
  | "follow_up_2"
  | "follow_up_3";

/** Row shape from Supabase `leads` (used across the app) */
export type Lead = {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone?: string | null;
  company_name: string | null;
  city: string | null;
  company_website: string | null;
  linkedin_url: string | null;
  client_type: number;
  status: string;
  notes: string | null;
  generated_email: string | null;
  follow_up_1: string | null;
  follow_up_2: string | null;
  follow_up_3: string | null;
  [key: string]: unknown;
};
