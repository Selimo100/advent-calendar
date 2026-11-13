/** Wire types shared by the API and the frontend. */
import type { CalendarSettings, DeliveredBlock } from './content/schema.ts';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'CSRF_REJECTED'
  | 'INVALID_REQUEST'
  | 'METHOD_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'DOOR_LOCKED'
  | 'DOOR_MISSED'
  | 'DAILY_LIMIT_REACHED'
  | 'DOOR_NOT_OPENED'
  | 'CONTENT_NOT_READY'
  | 'MEDIA_NOT_FOUND'
  | 'CALENDAR_NOT_CONFIGURED'
  | 'SERVER_MISCONFIGURED'
  | 'BACKEND_UNAVAILABLE';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; retryAfterSeconds?: number };
}

/**
 * Door state as presented to the client.
 * - locked:     future door (or before the calendar starts)
 * - available:  today's door, ready to open
 * - not_ready:  today's door, but its content has not been published yet
 * - opened:     opened before; content can be fetched
 * - missed:     its date has passed without an opening (STRICT_DATE)
 */
export type DoorState = 'locked' | 'available' | 'not_ready' | 'opened' | 'missed';

export interface DoorSummary {
  day: number;
  state: DoorState;
  /** Only for opened doors. */
  openedAt?: string;
  /** Only for opened doors. */
  title?: string;
}

export interface CalendarOverview {
  calendar: {
    id: string;
    year: number;
    policy: 'STRICT_DATE';
    settings: CalendarSettings;
  };
  serverTime: string;
  /** ISO date (YYYY-MM-DD) in Europe/Zurich. */
  today: string;
  phase: 'before' | 'advent' | 'after';
  todayDoor: number | null;
  startsAt: string;
  nextTransitionAt: string | null;
  doors: DoorSummary[];
  progress: { opened: number; total: number };
}

export interface DoorContent {
  day: number;
  title: string;
  /** ISO date of the door (YYYY-MM-DD). */
  date: string;
  openedAt: string;
  layout: 'standard' | 'final';
  blocks: DeliveredBlock[];
}

export interface OpenDoorResult {
  door: DoorContent;
  /** True when this request created the opening; false for a safe retry. */
  firstOpen: boolean;
}

export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHENTICATED: 'Bitte melde dich wieder an.',
  INVALID_CREDENTIALS: 'Dieser Zugangscode passt leider nicht.',
  RATE_LIMITED: 'Zu viele Versuche. Bitte warte einen Moment.',
  CSRF_REJECTED: 'Diese Anfrage wurde aus Sicherheitsgründen abgelehnt.',
  INVALID_REQUEST: 'Diese Anfrage ist ungültig.',
  METHOD_NOT_ALLOWED: 'Diese Anfrage ist nicht erlaubt.',
  NOT_FOUND: 'Nicht gefunden.',
  DOOR_LOCKED: 'Dieses Türchen ist noch verschlossen.',
  DOOR_MISSED: 'Dieses Türchen bleibt geschlossen.',
  DAILY_LIMIT_REACHED: 'Heute wurde schon ein Türchen geöffnet.',
  DOOR_NOT_OPENED: 'Dieses Türchen wurde noch nicht geöffnet.',
  CONTENT_NOT_READY: 'Dieses Türchen wird gerade noch liebevoll vorbereitet.',
  MEDIA_NOT_FOUND: 'Diese Datei ist nicht verfügbar.',
  CALENDAR_NOT_CONFIGURED: 'Der Kalender ist noch nicht eingerichtet.',
  SERVER_MISCONFIGURED: 'Der Kalender ist gerade nicht erreichbar.',
  BACKEND_UNAVAILABLE: 'Der Kalender ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.',
};
