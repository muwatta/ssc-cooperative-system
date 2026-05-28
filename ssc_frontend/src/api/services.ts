/**
 * SSC Cooperative — API Services
 * All API calls go through here. Never call axios directly from components.
 */

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
    staff_id: string;
    password: string;
    password_confirm: string;
  }) => api.post("/accounts/set-password/", data),
};

// MEMBERS

export const membersApi = {
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
  // Member balance (total, committed, available)
  getBalance: (memberId: number) =>
    api.get<MemberBalance>(`/savings/balance/${memberId}/`),

  summary: () => api.get<SavingsSummary>("/savings/summary/"),

  // Savings ledger for a member
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
  ) =>
    api.get<Blob>(`/savings/ledger/${memberId}/export/`, {
      params,
      responseType: "blob",
    }),
    
  // Post monthly savings entry (Admin only)
  postSavings: (data: {
    member: number;
    amount: string | number;
    hijri_month: number;
    hijri_year: number;
  }) => api.post<SavingsLedgerEntry>("/savings/post/", data),

  // Post termly dues against members (Admin only)
  postDues: (data: {
    amount: string | number;
    hijri_month: number;
    hijri_year: number;
    member_ids?: number[]; // empty = all active members
    description?: string;
  }) => api.post("/savings/dues/", data),

  // Savings increase/decrease requests
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
      data: {
        effective_hijri_month: number;
        effective_hijri_year: number;
      },
    ) =>
      api.post<SavingsChangeRequest>(
        `/savings/change-requests/${id}/approve/`,
        data,
      ),

    reject: (id: number) =>
      api.post<SavingsChangeRequest>(`/savings/change-requests/${id}/reject/`),
  },
};

export const loansApi = {
  list: (params?: { status?: string; page?: number }) =>
    api.get<PaginatedResponse<LoanApplication>>("/loans/", { params }),

  mine: () => api.get<PaginatedResponse<LoanApplication>>("/loans/mine/"),

  eligibility: () => api.get<LoanEligibilityResponse>("/loans/eligibility/"),

  apply: (data: Record<string, unknown>) =>
    api.post<LoanApplication>("/loans/apply/", data),

  committeeDecision: (id: number, data: Record<string, unknown>) =>
    api.post<LoanApplication>(`/loans/${id}/committee-decision/`, data),

  hosApprove: (id: number) =>
    api.post<LoanApplication>(`/loans/${id}/hos-approve/`),

  get: (id: number) => api.get<LoanApplication>(`/loans/${id}/`),

  postRepayment: (id: number, data: Record<string, unknown>) =>
    api.post(`/loans/${id}/repayment/`, data),

  repaymentHistory: (id: number) => api.get(`/loans/${id}/repayments/`),
};

export const suretiesApi = {
  mine: () => api.get<PaginatedResponse<SuretyRecord>>("/sureties/mine/"),

  loan: (loanId: number) =>
    api.get<PaginatedResponse<SuretyRecord>>(`/sureties/loan/${loanId}/`),

  confirm: (id: number) => api.post<SuretyRecord>(`/sureties/${id}/confirm/`),

  decline: (id: number) => api.post<SuretyRecord>(`/sureties/${id}/decline/`),

  checkEligibility: (memberId: number, amount: number) =>
    api.get(`/sureties/check-eligibility/${memberId}/`, {
      params: { amount },
    }),
};

export const notificationsApi = {
  list: () => api.get<PaginatedResponse<Notification>>("/notifications/"),
  unreadCount: () =>
    api.get<{ unread_count: number }>("/notifications/unread-count/"),
  markRead: (id: number) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post(`/notifications/mark-all-read/`),
};

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
