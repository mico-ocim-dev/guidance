export type AppointmentType =
  | "Online"
  | "Walk-in"
  | "Consultation"
  | "Counseling"
  | "Document Request"
  | "Others";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type DocumentRequestStatus =
  | "pending"
  | "processing"
  | "ready"
  | "released"
  | "cancelled";

export type ProfileRole = "user" | "staff" | "admin";

export interface Profile {
  id: string;
  first_name: string;
  mi: string | null;
  last_name: string;
  username: string;
  email: string;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  appointment_type: AppointmentType;
  purpose: string | null;
  preferred_date: string;
  preferred_time: string;
  status: AppointmentStatus;
  created_at: string;
}

export interface DocumentRequest {
  id: string;
  tracking_number: string;
  user_id: string | null;
  requester_name: string;
  requester_email: string;
  document_type: string | null;
  status: DocumentRequestStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  archived_at?: string | null;
}

export interface RequestStatusLog {
  id: string;
  document_request_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string | null;
  subject: string;
  description: string | null;
  requester_email: string;
  requester_name: string | null;
  status: string;
  priority: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  sort_order: number;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  question_id: string;
  response_value: string | null;
  response_number: number | null;
  respondent_id: string | null;
  respondent_email: string | null;
  created_at: string;
}

export interface LogbookEntry {
  id: string;
  visitor_name: string;
  visitor_email: string | null;
  visitor_phone: string | null;
  purpose: string | null;
  check_in_at: string;
  check_out_at: string | null;
  checked_in_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyReport {
  id: string;
  report_month: string;
  report_type: string;
  data: Record<string, unknown>;
  created_at: string;
  created_by: string | null;
}

export interface ImportLog {
  id: string;
  import_type: string;
  file_name: string | null;
  total_rows: number | null;
  imported_rows: number | null;
  failed_rows: number | null;
  errors: unknown;
  imported_by: string | null;
  created_at: string;
}
