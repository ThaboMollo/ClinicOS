export type AppointmentStatus =
  | "scheduled"
  | "waiting"
  | "in_consultation"
  | "done"
  | "cancelled";

export type UserRole = "admin" | "reception" | "doctor";
export type QuestionType = "text" | "dropdown" | "scale" | "boolean";
export type ActorType = "patient" | "staff";

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  phone: string | null;
  avg_consultation_minutes: number;
  created_at: string;
}

export interface Profile {
  id: string;
  clinic_id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  clinic_id: string;
  name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  status: AppointmentStatus;
  appointment_date: string;
  access_token: string; // NEVER display in UI
  entered_queue_at: string;
  consultation_started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface IntakeResponse {
  id: string;
  appointment_id: string;
  clinic_id: string;
  question_id: string | null;
  question_key: string;
  question_text: string;
  answer: string;
  created_at: string;
}

export interface AppointmentEvent {
  id: string;
  clinic_id: string;
  appointment_id: string;
  actor_type: ActorType;
  actor_user_id: string | null;
  event_type: string;
  from_status: AppointmentStatus | null;
  to_status: AppointmentStatus | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface ClinicIntakeQuestion {
  id: string;
  clinic_id: string;
  template_id: string | null;
  inherit_global: boolean;
  question_text: string | null;
  question_type: QuestionType | null;
  options: string[] | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface IntakeQuestionTemplate {
  id: string;
  question_key: string;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  sort_order: number;
  is_active: boolean;
}

export interface AppointmentWithPatient extends Appointment {
  patients: Pick<Patient, "id" | "name" | "phone">;
}
