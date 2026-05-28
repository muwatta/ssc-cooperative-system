# Solace Staff Cooperative Management System (SSC)

A modern cooperative management platform for **Solace Staff Cooperative Ltd**, built to digitize staff savings, loans, suretyship, dues management, and investment tracking across school branches.

Built by **Algorise Tech Explorers**.

![Django](https://img.shields.io/badge/Django-5.0-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-blue)

---

# Overview

SSC helps school staff manage cooperative activities in one centralized platform.

Core modules include:

* Member registration and management
* Monthly savings contribution tracking
* Termly dues management
* Loan application and approval workflow
* Suretyship management
* Investment and profit distribution
* Member dashboard and statements
* Admin reporting and analytics

The system uses the **Islamic (Hijri) calendar** as the primary operational calendar for savings, loans, and dues records.

---

# Tech Stack

| Layer          |                                Stack |
| -------------- | -----------------------------------: |
| Frontend       | React + TypeScript + Tailwind + Vite |
| Backend        |       Django + Django REST Framework |
| Database       |              PostgreSQL via Supabase |
| Authentication |                                  JWT |
| Deployment     |            Vercel + Railway / Render |
| Reporting      |                            ReportLab |
| Calendar       |                    Hijri + Gregorian |

---

# Project Structure

```bash
ssc_projects/
├── ssc_backend/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── savings/
│   │   ├── loans/
│   │   ├── sureties/
│   │   ├── investments/
│   │   └── notifications/
│   ├── config/
│   ├── utils/
│   ├── manage.py
│   └── requirements.txt
│
├── ssc_frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── router/
│   │   └── types/
│   └── package.json
│
└── README.md
```

---

# Features

## Member Management

* Staff registration via Staff ID registry
* Automatic cooperative file number generation
* Membership approval workflow
* Active / inactive / exited member tracking

---

## Savings

* Monthly contribution posting
* Savings ledger history
* Termly dues deduction
* Balance calculation
* Eligibility tracking

---

## Loans

* Loan application portal
* Available balance eligibility checks
* Surety request flow
* Committee approval
* Head of School final approval
* Repayment tracking

---

## Sureties

* Self-surety support
* External surety confirmations
* Liability locking
* Auto-release on repayment completion

---

## Authentication

* Staff ID login
* JWT access and refresh tokens
* Role-based permissions
* First-time password setup

---

# User Roles

| Permission       | Admin | Committee | HOS | Staff |
| ---------------- | ----: | --------: | --: | ----: |
| Register Members |     ✅ |         ❌ |   ❌ |     ❌ |
| View All Members |     ✅ |         ✅ |   ✅ |     ❌ |
| Post Savings     |     ✅ |         ❌ |   ❌ |     ❌ |
| Apply for Loan   |    ✅* |         ✅ |   ❌ |     ✅ |
| Approve Loan     |     ✅ |         ✅ |   ❌ |     ❌ |
| Final Approval   |     ❌ |         ❌ |   ✅ |     ❌ |
| Confirm Surety   |     ✅ |         ✅ |   ❌ |     ✅ |

*Admin cannot approve their own loans.*

---

# Local Development

## Prerequisites

* Python 3.11+
* Node.js 18+
* Git
* Supabase project or PostgreSQL database

---

# Backend Setup

```bash
cd ssc_backend
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

Create `.env`

```env
SECRET_KEY=your-secret-key
DEBUG=True

DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=your-host
DB_PORT=5432
```

Run migrations:

```bash
python manage.py migrate
```

Create admin:

```bash
python manage.py createsuperuser
```

Run server:

```bash
python manage.py runserver
```

Backend:

```bash
http://127.0.0.1:8000
```

---

# Frontend Setup

```bash
cd ssc_frontend
npm install
npm run dev
```

Frontend:

```bash
http://localhost:5173
```

---

# API Base URL

```bash
/api/v1/
```

Important routes:

## Auth

```bash
POST /api/v1/auth/login/
POST /api/v1/auth/refresh/
POST /api/v1/auth/logout/
```

## Accounts

```bash
GET /api/v1/accounts/me/
GET /api/v1/accounts/members/
POST /api/v1/accounts/members/
```

## Savings

```bash
GET /api/v1/savings/
POST /api/v1/savings/
```

## Loans

```bash
GET /api/v1/loans/
POST /api/v1/loans/
```

## Sureties

```bash
GET /api/v1/sureties/
POST /api/v1/sureties/
```

---

# Business Rules

## Savings

* Minimum monthly savings: ₦1,000
* Minimum 6 months contribution history before loan eligibility
* Missing contribution may affect eligibility

## Loans

* Maximum loan = 75% of available balance
* Maximum repayment period = 12 months
* One active loan per member

## Sureties

* Minimum 6 months savings history before acting as surety
* Surety liability remains locked until repayment completion

---

# Current Development Status

## Completed

* Authentication with JWT
* Staff ID registry
* Member management
* Savings module
* Loan application workflow
* Surety workflow
* Dashboard role access

## In Progress

* Investments module
* PDF statements and printable reports
* Notifications
* Advanced analytics

## Planned

* PWA offline support
* Push notifications
* Legacy data migration
* Export tools

---

# Testing

Backend:

```bash
python manage.py test
```

Frontend:

```bash
npm run test
```

---

# Team

Built by **Algorise Tech Explorers**

Founder and Lead Engineer:

**Abdullahi Oladipupo Musliudeen**

---

# License

Proprietary software.

All rights reserved by Solace Staff Cooperative Ltd and Algorise Tech Explorers.

---

# Notes

* Islamic (Hijri) calendar is the primary business calendar
* Staff ID format follows:

```bash
S43-0001
```

* File number format:

```bash
A001
A002
A003
```


Developed for **Solace Staff Cooperative Ltd** by **Algorise Tech Explorers**.
