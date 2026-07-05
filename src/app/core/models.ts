/**
 * Shared data models. These mirror the D1 schema (see migrations/0001_init.sql)
 * and the JSON shapes returned by the Worker API (worker/routes/*).
 */

export interface FamilyMember {
  id: string;
  name: string;
  date_of_birth: string | null;
  sex: string | null;
  blood_type: string | null;
  relationship: string | null;
  notes: string | null;
  color: string | null;
  photo_r2_key: string | null;
  created_at: string;
  updated_at: string;
}

/** How much of a record's event_date is known: full day, month+year, or year only. */
export type DatePrecision = 'day' | 'month' | 'year';

/** A field descriptor stored in RecordType.schema_json to drive dynamic form inputs. */
export interface ExtraField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea';
}

export interface RecordType {
  id: string;
  key: string;
  label: string;
  icon: string | null;
  schema_json: string | null;
  is_system: number;
  sort_order: number;
}

export interface HealthRecord {
  id: string;
  family_member_id: string;
  record_type_id: string;
  title: string;
  event_date: string | null;
  /** Granularity of event_date. Defaults to 'day' for full dates. */
  date_precision: DatePrecision;
  provider: string | null;
  location: string | null;
  status: string | null;
  data_json: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined convenience fields returned by the API
  record_type_key?: string;
  record_type_label?: string;
  record_type_icon?: string | null;
  family_member_name?: string;
}

export type ScheduleStatus = 'pending' | 'done' | 'skipped';

export interface ScheduleItem {
  id: string;
  family_member_id: string;
  record_type_id: string | null;
  title: string;
  due_date: string | null;
  status: ScheduleStatus;
  recurrence: string | null;
  completed_record_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  family_member_name?: string;
  record_type_label?: string | null;
}

export interface DocumentMeta {
  id: string;
  family_member_id: string | null;
  record_id: string | null;
  r2_key: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  family_member_name?: string | null;
}

export type AlertSeverity = 'info' | 'warning' | 'urgent';

export interface AlertItem {
  /** Manual alert row id, or a synthetic id like "schedule:<scheduleItemId>" for derived alerts. */
  id: string;
  family_member_id: string | null;
  schedule_item_id?: string | null;
  severity: AlertSeverity;
  title: string;
  message: string | null;
  due_date: string | null;
  source: 'manual' | 'schedule';
  status: string;
  family_member_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Identity {
  email: string;
  dev?: boolean;
}
