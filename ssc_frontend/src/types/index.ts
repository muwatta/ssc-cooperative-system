export type Role = "admin" | "committee" | "head_of_school" | "staff";

export interface LoginRequest {
  staff_id: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  role: Role;
  staff_id: string;
  is_first_login: boolean;
  file_number: string | null;
  full_name: string | null;
}

export interface AuthUser {
  user_id: number;
  staff_id: string;
  role: Role;
  file_number: string | null;
  full_name: string | null;
}

// MEMBER

export type MembershipStatus = "pending" | "active" | "inactive" | "exited";
export type SchoolBranch = "primary" | "college" | "other";
export type MaritalStatus = "single" | "married" | "divorced" | "widowed";
export type Gender = "male" | "female";

export interface MemberProfile {
  id: number;
  file_number: string;
  staff_id: string;
  role: Role;
  full_name: string;
  phone_primary: string;
  phone_secondary: string;
  marital_status: MaritalStatus;
  gender: Gender;
  date_of_birth: string;
  place_of_birth: string;
  school_branch: SchoolBranch;
  designation: string;
  date_joined_school: string;
  monthly_income: string;
  approved_monthly_contribution: string;
  residential_address: string;
  permanent_home_address: string;
  email_address: string;
  social_media_handle: string;
  state_of_origin: string;
  local_government_area: string;
  next_of_kin_name: string;
  next_of_kin_address: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
  next_of_kin_place_of_work: string;
  membership_status: MembershipStatus;
  is_legacy: boolean;
  approved_by_name: string;
  officer_in_charge: string;
  approval_date: string | null;
  consecutive_savings_months: number;
  is_loan_eligible: boolean;
  is_surety_eligible: boolean;
  created_at: string;
  updated_at: string;
}

export interface MemberSummary {
  id: number;
  file_number: string;
  full_name: string;
  school_branch: SchoolBranch;
  designation: string;
  membership_status: MembershipStatus;
}

// SAVINGS

export type LedgerEntryType =
  | "ordinary_savings"
  | "termly_dues"
  | "profit_share"
  | "adjustment"
  | "legacy_import";

export interface SavingsLedgerEntry {
  id: number;
  member: number;
  member_file_number: string;
  member_name: string;
  hijri_month: number;
  hijri_year: number;
  hijri_display: string; // example "Rajab 1443"
  gregorian_date: string;
  entry_type: LedgerEntryType;
  details: string;
  debit: string | null;
  credit: string | null;
  balance: string;
  verified_by_name: string;
  verified_by_role: string;
  created_at: string;
}

export interface MemberBalance {
  member_id: number;
  file_number: string;
  full_name: string;
  total_savings: string;
  suretyship_committed: string;
  available_balance: string;
}

export interface SavingsSummary {
  member: MemberBalance | null;
  cooperative: {
    total_savings: string;
    total_committed: string;
    total_available: string;
    member_count: number;
  };
}

export type SavingsChangeStatus = "pending" | "approved" | "rejected";

export interface SavingsChangeRequest {
  id: number;
  member: number;
  member_file_number: string;
  member_name: string;
  current_amount: string;
  requested_amount: string;
  savings_balance_at_request: string;
  loan_balance_at_request: string;
  effective_hijri_month: number | null;
  effective_hijri_year: number | null;
  effective_hijri_display: string | null;
  status: SavingsChangeStatus;
  approved_by_name: string;
  submitted_at: string;
  approved_at: string | null;
}

// HIJRI CALENDAR

export interface HijriMonth {
  value: number;
  label: string;
}

export const HIJRI_MONTHS: HijriMonth[] = [
  { value: 1, label: "Muharram" },
  { value: 2, label: "Safar" },
  { value: 3, label: "Rabi' al-Awwal" },
  { value: 4, label: "Rabi' al-Thani" },
  { value: 5, label: "Jumada al-Ula" },
  { value: 6, label: "Jumada al-Akhira" },
  { value: 7, label: "Rajab" },
  { value: 8, label: "Sha'ban" },
  { value: 9, label: "Ramadan" },
  { value: 10, label: "Shawwal" },
  { value: 11, label: "Dhul Qa'da" },
  { value: 12, label: "Dhul Hijja" },
];

// API PAGINATION

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// STAFF ID REGISTRY

export interface StaffIDEntry {
  id: number;
  staff_id: string;
  is_active: boolean;
  created_at: string;
}

export type LoanStatus =
  | "submitted"
  | "under_review"
  | "pending_sureties"
  | "approved"
  | "hos_approved"
  | "active"
  | "completed"
  | "rejected"
  | "defaulted";

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  pending_sureties: "Pending Surety Confirmation",
  approved: "Committee Approved",
  hos_approved: "HOS Approved — Active",
  active: "Active",
  completed: "Completed",
  rejected: "Rejected",
  defaulted: "Defaulted",
};

export const LOAN_STATUS_COLORS: Record<LoanStatus, string> = {
  submitted: "badge-gray",
  under_review: "badge-warning",
  pending_sureties: "badge-warning",
  approved: "badge-primary",
  hos_approved: "badge-success",
  active: "badge-success",
  completed: "badge-success",
  rejected: "badge-danger",
  defaulted: "badge-danger",
};

export interface LoanApplication {
  id: number;
  applicant: number;
  applicant_file_number: string;
  applicant_name: string;
  home_address: string;
  phone_numbers: string;
  school_branch: string;
  designation: string;
  date_joined_cooperative: string;
  monthly_contribution: string;
  total_amount_saved: string;
  monthly_salary: string;
  date_of_last_loan: string | null;
  amount_outstanding_prev: string;
  amount_applied: string;
  purpose: string;
  proposed_monthly_repayment: string;
  proposed_duration_months: number;
  repayment_start_hijri_month: number | null;
  repayment_start_hijri_year: number | null;
  repayment_end_hijri_month: number | null;
  repayment_end_hijri_year: number | null;
  status: LoanStatus;
  amount_approved: string | null;
  outstanding_balance: string;
  committee_decision_note: string;
  application_hijri_month: number | null;
  application_hijri_year: number | null;
  application_hijri_display: string;
  created_at: string;
  updated_at: string;
}

export interface LoanEligibilityResponse {
  eligible: boolean;
  reasons: string[];
  max_borrowable: string;
  consecutive_months: number;
}

export type SuretyStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "released"
  | "defaulted";

export interface SuretyRecord {
  id: number;
  loan: number;
  surety?: number;
  layer?: number;
  is_self_surety?: boolean;
  amount_guaranteed: string;
  current_liability: string;
  status: SuretyStatus;
  confirmed_at?: string | null;
  released_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface InvestmentRecord {
  id: number;
  name: string;
  amount: string;
  hijri_display: string;
  recorded_by_id: number;
}

export interface InvestmentDistribution {
  id: number;
  investment_name: string;
  profit_percentage: string;
  total_profit: string;
  hijri_display: string;
  is_distributed: boolean;
}
