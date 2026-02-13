export type TripSettings = {
  tripStart: string; // ISO date
  tripEnd: string;
  timezone: string;
};

export type ApiKeysConfig = {
  openai?: string;
  finnhub?: string;
  elevenlabs?: string;
};

export type Event = {
  id: string;
  title: string;
  start: string; // ISO datetime
  end?: string;
  location?: string;
  contactId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  name: string;
  company?: string;
  role?: string;
  phone?: string;
  email?: string;
  stockTicker?: string;
  notes?: string;
  pronouns?: string;
  photoUrl?: string;
  linkedInUrl?: string;
  researchSummary?: string;
  displaySummary?: string;
  researchTaskId?: string;
  researchTaskStatus?: string;
  eventIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type Todo = {
  id: string;
  text: string;
  done: boolean;
  dueDate?: string; // ISO date
  createdAt: string;
  updatedAt: string;
};

export type MeetingDossier = {
  id: string;
  contactId: string;
  eventId?: string;
  transcript?: string;
  summary?: string;
  actionItems?: string[];
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlannedRoute = {
  id: string;
  from: string;
  to: string;
  date: string; // ISO date
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedPlace = {
  id: string;
  label: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

export type UserSettingsDoc = {
  tripStart: string;
  tripEnd: string;
  timezone: string;
  apiKeys?: ApiKeysConfig;
  savedPlaces?: SavedPlace[];
};
