import api from "./client";
import type {
  LoginRequest,
  LoginResponse,
  MemberProfile,
  MemberSummary,
  PaginatedResponse,
  Role,
  StaffIDEntry,
  SavingsLedgerEntry,
  MemberBalance,
  SavingsSummary,
  SavingsChangeRequest,
  LoanApplication,
  LoanEligibilityResponse,
  SuretyRecord,
  Notification,
  InvestmentRecord,
  InvestmentDistribution,
  LoanSettings,
} from "@/types";

// AUTH
export const authApi = {
  login: (data: LoginRequest) => api.post<LoginResponse>("/auth/login/", data),
  logout: (refresh: string) => api.post("/auth/logout/", { refresh }),
  refresh: (refresh: string) =>
    api.post<{ access: string; refresh: string }>("/auth/refresh/", {
      refresh,
    }),
  setInitialPassword: (data: {
    staff_id?: string;
    token?: string;
    password: string;
    password_confirm: string;
  }) => api.post("/accounts/set-password/", data),
};

// MEMBERS
export const membersApi = {
  counts: () =>
    api
      .get<{
        total: number;
        active: number;
        pending: number;
        inactive: number;
        exited: number;
      }>("/accounts/members/counts/")
      .then((r) => r.data),
  me: () => api.get<MemberProfile | null>("/accounts/me/"),
  list: (params?: {
    page?: number;
    search?: string;
    membership_status?: string;
    school_branch?: string;
  }) =>
    api.get<PaginatedResponse<MemberProfile>>("/accounts/members/", { params }),
  summary: (search?: string) =>
    api.get<PaginatedResponse<MemberSummary>>("/accounts/members/summary/", {
      params: search ? { search } : undefined,
    }),
  get: (id: number) => api.get<MemberProfile>(`/accounts/members/${id}/`),
  create: (data: Record<string, unknown>) =>
    api.post<MemberProfile>("/accounts/members/", data),
  update: (id: number, data: Partial<MemberProfile>) =>
    api.patch<MemberProfile>(`/accounts/members/${id}/`, data),
  createMe: (data: Partial<MemberProfile>) =>
    api.post<MemberProfile>("/accounts/me/", data),
  updateMe: (data: Partial<MemberProfile>) =>
    api.patch<MemberProfile>("/accounts/me/", data),
  approve: (
    id: number,
    data: {
      approved_by_name: string;
      officer_in_charge: string;
      approval_date: string;
      approved_monthly_contribution: string;
    },
  ) => api.post<MemberProfile>(`/accounts/members/${id}/approve/`, data),
  deactivate: (id: number) => api.post(`/accounts/members/${id}/deactivate/`),
  importLegacy: (
    file: File,
    dry_run = true,
    opts?: {
      field_map?: Record<string, string>;
      staff_id_template?: string;
      create_registry?: boolean;
      start_seq?: number;
      download_errors?: boolean;
    },
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("dry_run", dry_run ? "1" : "0");
    if (opts?.field_map) fd.append("field_map", JSON.stringify(opts.field_map));
    if (opts?.staff_id_template)
      fd.append("staff_id_template", opts.staff_id_template);
    if (opts?.create_registry)
      fd.append("create_registry", opts.create_registry ? "1" : "0");
    if (opts?.start_seq) fd.append("start_seq", String(opts.start_seq));
    if (opts?.download_errors)
      fd.append("download_errors", opts.download_errors ? "1" : "0");
    return api.post("/accounts/members/legacy-import/", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      responseType: opts?.download_errors ? "blob" : undefined,
    });
  },
};

// STAFF ID REGISTRY
export const staffIdApi = {
  list: (search?: string) =>
    api.get<PaginatedResponse<StaffIDEntry>>("/accounts/staff-ids/", {
      params: search ? { search } : undefined,
    }),
  create: (staff_id: string) =>
    api.post<StaffIDEntry>("/accounts/staff-ids/", { staff_id }),
  update: (id: number, data: Partial<StaffIDEntry>) =>
    api.patch<StaffIDEntry>(`/accounts/staff-ids/${id}/`, data),
  delete: (id: number) => api.delete(`/accounts/staff-ids/${id}/`),
};

export const usersApi = {
  create: (data: {
    staff_id: string;
    role: Role;
    password: string;
    is_first_login: boolean;
  }) => api.post("/accounts/users/", data),
};

// SAVINGS
export const savingsApi = {
  getBalance: (memberId: number) =>
    api.get<MemberBalance>(`/savings/balance/${memberId}/`),
  summary: () => api.get<SavingsSummary>("/savings/summary/"),
  getLedger: (
    memberId: number,
    params?: {
      page?: number;
      hijri_month?: number;
      hijri_year?: number;
      date_from?: string;
      date_to?: string;
    },
  ) =>
    api.get<PaginatedResponse<SavingsLedgerEntry>>(
      `/savings/ledger/${memberId}/`,
      { params },
    ),
  exportLedger: (
    memberId: number,
    params?: {
      hijri_month?: number;
      hijri_year?: number;
      date_from?: string;
      date_to?: string;
    },
    format: "csv" | "pdf" = "csv",
  ) =>
    api.get<Blob>(`/savings/ledger/${memberId}/export/`, {
      params: { ...params, format },
      responseType: "blob",
    }),
  exportBulkReport: (
    params?: {
      member_id?: number;
      member_ids?: string;
      hijri_month?: number;
      hijri_year?: number;
      date_from?: string;
      date_to?: string;
      entry_type?: string;
    },
    format: "csv" | "pdf" = "csv",
  ) =>
    api.get<Blob>(`/savings/reports/export/`, {
      params: { ...params, format },
      responseType: "blob",
    }),
  postSpecialSavings: (data: {
    member_id: number;
    amount: string | number;
    hijri_month: number;
    hijri_year: number;
    details?: string;
  }) =>
    api.post<{
      message: string;
      entry_id: number;
      special_savings: string;
      total_savings: string;
      available_balance: string;
    }>("/savings/special-savings/", data),
  withdrawSpecialSavings: (data: {
    member_id: number;
    amount: string;
    hijri_month: number;
    hijri_year: number;
  }) => api.post("/savings/special-savings/withdraw/", data),
  getSpecialSavingsBalance: (memberId: number) =>
    api.get<{
      special_savings: string;
      total_savings: string;
      available_balance: string;
    }>(`/savings/balance/${memberId}/`),
  postSavings: (data: {
    member?: number;
    member_ids?: number[];
    amount: string | number;
    hijri_month: number;
    hijri_year: number;
  }) => api.post<SavingsLedgerEntry>("/savings/post/", data),
  postDues: (data: {
    amount: string | number;
    hijri_month: number;
    hijri_year: number;
    member_ids?: number[];
    description?: string;
  }) => api.post("/savings/dues/", data),
  changeRequests: {
    list: (params?: { status?: string; page?: number }) =>
      api.get<PaginatedResponse<SavingsChangeRequest>>(
        "/savings/change-requests/",
        { params },
      ),
    create: (data: { requested_amount: string }) =>
      api.post<SavingsChangeRequest>("/savings/change-requests/", data),
    approve: (
      id: number,
      data: { effective_hijri_month: number; effective_hijri_year: number },
    ) =>
      api.post<SavingsChangeRequest>(
        `/savings/change-requests/${id}/approve/`,
        data,
      ),
    reject: (id: number) =>
      api.post<SavingsChangeRequest>(`/savings/change-requests/${id}/reject/`),
  },
};

// LOANS
export const loansApi = {
  list: (params?: { status?: string; page?: number }) =>
    api.get<PaginatedResponse<LoanApplication>>("/loans/", { params }),
  mine: () => api.get<PaginatedResponse<LoanApplication>>("/loans/mine/"),
  pendingCount: () =>
    api.get<{
      pending_admin?: number;
      submitted?: number;
      under_review?: number;
      pending_sureties?: number;
    }>("/loans/pending-count/"),
  eligibility: () => api.get<LoanEligibilityResponse>("/loans/eligibility/"),
  settings: () => api.get<LoanSettings>("/loans/settings/"),
  updateSettings: (data: Partial<LoanSettings>) =>
    api.patch<LoanSettings>("/loans/settings/", data),
  apply: (data: Record<string, unknown>) =>
    api.post<LoanApplication>("/loans/apply/", data),
  committeeDecision: (id: number, data: Record<string, unknown>) =>
    api.post<LoanApplication>(`/loans/${id}/committee-decision/`, data),
  adminApprove: (id: number, data: Record<string, unknown> = {}) =>
    api.post<LoanApplication>(`/loans/${id}/admin-approve/`, data),
  hosApprove: (id: number) =>
    api.post<LoanApplication>(`/loans/${id}/hos-approve/`),
  get: (id: number) => api.get<LoanApplication>(`/loans/${id}/`),
  getAdminPreview: (id: number) =>
    api.get(`/loans/${id}/admin-approval-preview/`),
  postRepayment: (id: number, data: Record<string, unknown>) =>
    api.post(`/loans/${id}/repayment/`, data),
  repaymentHistory: (id: number) => api.get(`/loans/${id}/repayments/`),
  exportRepayments: (id: number, format: "csv" | "pdf" = "csv") =>
    api.get<Blob>(`/loans/${id}/repayments/export/`, {
      params: { format },
      responseType: "blob",
    }),
  saveDraft: (data: Record<string, unknown>) =>
    api.post("/loans/draft/", { data }),
  getDraft: () =>
    api.get<{ data: Record<string, unknown>; updated_at: string }>(
      "/loans/draft/",
    ),
};

// SURETIES
export const suretiesApi = {
  mine: () => api.get<PaginatedResponse<SuretyRecord>>("/sureties/mine/"),
  loan: (loanId: number) =>
    api.get<PaginatedResponse<SuretyRecord>>(`/sureties/loan/${loanId}/`),
  confirm: (id: number) => api.post<SuretyRecord>(`/sureties/${id}/confirm/`),
  decline: (id: number) => api.post<SuretyRecord>(`/sureties/${id}/decline/`),
  checkEligibility: (memberId: number, amount: number) =>
    api.get(`/sureties/check-eligibility/${memberId}/`, { params: { amount } }),
  checkEligibilityBatch: (
    sureties: Array<{ row_id: string; member_id: number; amount: number }>,
  ) => api.post(`/sureties/check-eligibility/batch/`, { sureties }),
};

// NOTIFICATIONS
export const notificationsApi = {
  list: () => api.get<PaginatedResponse<Notification>>("/notifications/"),
  unreadCount: () =>
    api.get<{ unread_count: number }>("/notifications/unread-count/"),
  markRead: (id: number) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post(`/notifications/mark-all-read/`),
};

// INVESTMENTS
export const investmentsApi = {
  list: () => api.get<PaginatedResponse<InvestmentRecord>>("/investments/"),
  create: (data: Record<string, unknown>) =>
    api.post<InvestmentRecord>("/investments/", data),
  distributions: {
    list: () =>
      api.get<PaginatedResponse<InvestmentDistribution>>(
        "/investments/distributions/",
      ),
    create: (data: Record<string, unknown>) =>
      api.post<InvestmentDistribution>("/investments/distributions/", data),
    distribute: (id: number) =>
      api.post(`/investments/distributions/${id}/distribute/`),
  },
};
