# SSC Frontend Documentation

## Overview

This document describes the current frontend implementation, what has been completed, what remains, and how the main pages work.

## Completed Work

- Implemented frontend API layer in `src/api/services.ts` and global Axios client in `src/api/client.ts`.
- Added development fallback for API base URL so frontend can call the Django backend at `http://127.0.0.1:8000/api/v1` when `VITE_API_URL` is not configured.
- Implemented `LoanQueuePage` in `src/pages/committee/LoanQueuePage.tsx` with committee review and HOS approval modals.
- Implemented `MyProfilePage` in `src/pages/shared/MyProfilePage.tsx` with profile fetch, create, and update flow.
- Implemented `MySavingsPage` in `src/pages/shared/MySavingsPage.tsx` with savings summary, ledger filters, pagination support, and CSV export.
- Added route definitions in `src/routes/index.tsx` with authenticated routing and role-based access control.
- Fixed Tailwind editor validation issues by adding workspace `.vscode/settings.json` to disable VS Code CSS/SCSS/LESS validation for `@tailwind` and `@apply` directives.
- Added accessible label support for page controls such as the loan status filter in `LoanQueuePage.tsx`.

## Remaining Work

- Confirm backend session/auth integration and ensure the Django backend is running at `127.0.0.1:8000` during local development.
- Confirm that all backend routes used by `membersApi.me()` exist and that the current user has a member profile, to avoid `404 /accounts/me/`.
- Expand or complete the admin pages if not already implemented: `MembersListPage`, `MemberDetailPage`, `AddMemberPage`, `CreateUserPage`, `StaffIDRegistryPage`, `PostSavingsPage`, `PostDuesPage`.
- Implement the Head of School loan approvals page (`/loan-approvals`) currently routed to `ComingSoonPage`.
- Review and expand reports and analytics pages if needed.
- Verify and handle error states uniformly across pages, especially API failures and authentication refresh.

## Page Behavior

### `src/pages/shared/MyProfilePage.tsx`

Purpose:

- Let authenticated users view, create, and update their member profile.

How it works:

- On mount, it requests `membersApi.me()`.
- If the API returns profile data, it stores the profile and pre-fills the form.
- If `/accounts/me/` returns `404`, it enters profile creation mode and displays a message to complete the form.
- On submit, it calls `membersApi.createMe(data)` when the profile is missing or `membersApi.updateMe(data)` when the profile exists.
- Uses `react-hook-form` to manage form state and field validation.
- Displays success or failure messages after submit.

Important details:

- The form covers personal info, contact details, status, school branch, salary, addresses, and next-of-kin details.
- Staff ID and file number are shown but disabled.

### `src/pages/shared/MySavingsPage.tsx`

Purpose:

- Show a user’s savings summary and ledger history.

How it works:

- On mount, it loads the current profile with `membersApi.me()`.
- When profile data is available, it loads savings data via `savingsApi.getBalance(profile.id)` and `savingsApi.getLedger(profile.id, params)`.
- Supports filters for Hijri month, Hijri year, date range, and pagination.
- Enables CSV export using `savingsApi.exportLedger(profile.id, params)`.
- Shows summary cards for total savings, available balance, approved contribution, loan eligibility, membership status, and consecutive months.

Important details:

- Uses local component state for loading, error, filters, and download state.
- Shows a friendly error if profile or savings history cannot be loaded.

### `src/pages/committee/LoanQueuePage.tsx`

Purpose:

- Give admins/committee members a queue for processing loan applications.

How it works:

- Loads loans using `loansApi.list({ status: statusFilter || undefined })` with `react-query`.
- Shows a status filter dropdown for `submitted`, `under_review`, `approved`, `active`, and `completed` loan states.
- Renders a table of loans with action buttons.
- For loans in review states, it shows a committee review modal.
- For `approved` loans, it shows a Head of School approval modal.

Committee modal:

- Allows approve/reject decisions.
- If approve is selected, the reviewer can change the approved amount.
- On success, invalidates the `loans-queue` query.

HOS modal:

- Sends final approval to `loansApi.hosApprove(loan.id)`.
- On success, invalidates the `loans-queue` query.

Important details:

- Uses `LoanStatusBadge` to display status styling.
- Uses `Modal`, `PageLoader`, `EmptyState`, and reusable components from `src/components/common`.

## API Layer

### `src/api/client.ts`

- Creates a shared Axios instance with a `baseURL` and JSON headers.
- Attaches the access token from `localStorage` to every request.
- Handles 401 token refresh with `auth/refresh/`.
- Uses a development fallback URL:
  - `VITE_API_URL` if provided
  - `http://127.0.0.1:8000/api/v1` in `development`
  - `/api/v1` otherwise

### `src/api/services.ts`

Defines the main API modules:

- `authApi` for login, logout, refresh, set-password.
- `membersApi` for profile and member management.
- `staffIdApi` and `usersApi` for admin user setup.
- `savingsApi` for balance, ledger, export, post savings/dues, and requests.
- `loansApi` for loan queue, eligibility, apply, committee/HOS actions, repayment.
- `suretiesApi` for surety records and eligibility checks.
- `notificationsApi` for notification listing and marking read.
- `investmentsApi` for investment records and distributions.

## Routing and Access

### `src/routes/index.tsx`

- Uses `react-router-dom` with `createBrowserRouter`.
- `GuestOnly` protects login and set-password routes.
- `RequireAuth` wraps all authenticated routes.
- `RequireRole` enforces role-based access:
  - `admin` routes for member management and savings posting
  - `admin` + `committee` routes for loan queue and reports
  - `head_of_school` routes for loan approvals placeholder
- Shared authenticated routes include `/dashboard`, `/profile`, and `/my-savings`.

## Notes

- The frontend build is currently successful, so current code is syntactically valid.
- The backend must be running and reachable during development to satisfy requests from pages like `/profile`, `/my-savings`, and `/loans/queue`.
- The code still has placeholders for some pages and needs validation for the full admin and head-of-school workflow.

---

### Recommended next steps

1. Start the backend on `127.0.0.1:8000` and confirm `/api/v1/accounts/me/` returns a profile.
2. Confirm the loan queue backend routes are live and returning data.
3. Review any unfinished admin pages and implement the placeholder `/loan-approvals` page.
4. Add any missing page documentation for admin modules once those pages are complete.
