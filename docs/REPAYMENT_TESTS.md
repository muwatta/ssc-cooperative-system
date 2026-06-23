Repayment Workflow — Manual Test Instructions

Prerequisites

- Backend running locally (Django) and accessible. Default API base URL configured in frontend.
- Frontend running via `npm run dev` or built assets served.
- A test admin or committee user with credentials and at least one active loan to post repayments for.

Quick start (dev)

1. Start backend (example):

```bash
# from SMS_backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py runserver
```

2. Start frontend dev server:

```bash
cd SMS_frontend
npm install
npm run dev
```

Test cases

1. Post repayment from Loan Queue (committee/admin)

- Login as a committee or admin user.
- Open "Loan Queue" from the sidebar.
- Filter to show `active` loans.
- Click `Post Repayment` on an active loan.
- In the modal, enter an amount ≤ outstanding balance, choose Hijri month/year, and submit.
- Expected: modal closes, the loan's outstanding balance updates (in UI list) and a new repayment row appears in the loan detail `Repayment History`.

2. Post repayment from Loan Detail (admin/committee)

- Navigate to a loan detail page (e.g., `/loans/123`).
- Click `Post Repayment` (button at top-right) to open the modal.
- Submit a repayment as above.
- Expected: Repayment appears in `Repayment History`, outstanding balance updates.

3. Repayment History pagination

- On the loan detail page, if there are many repayments, change the `Show` page size and use `Prev`/`Next` to navigate pages.
- Expected: the table updates with the requested page-size and page.

4. Export CSV

- On the loan detail page, click `Export CSV`.
- Expected: browser downloads a CSV file named like `loan-<id>-repayments.csv` containing the full (server-provided) repayment list.

5. Quick access from My Loans

- Login as Admin or Committee and open `My Loans`.
- Verify each loan row has a `View` button which navigates to `/loans/:id`.

Notes

- If pagination is large or server-side pagination is desired, update the API call to request pages from the server (`?page=`) and wire the backend pagination links.
- For automated tests, use React Testing Library to mock `loansApi.postRepayment` and `loansApi.repaymentHistory` and assert UI changes after mutation resolves.

Commands to run unit tests (if added later)

```bash
cd SMS_frontend
npm test
```

Contact

If something fails, capture browser console and network logs and backend server logs, then report the failing step with attached logs.
