# SSC Cooperative — Phase 1 Setup Guide

## 1. Python Environment

```bash
cd ssc_backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Environment Variables

```bash
cp .env.example .env
# Now open .env and fill in:
#   SECRET_KEY   → generate with: python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
#   DATABASE_URL → from Supabase Dashboard → Settings → Database → URI connection string
```

## 3. Supabase Database Setup

1. Open Supabase Dashboard → SQL Editor
2. Paste and run the entire contents of `supabase_schema_phase1.sql`
3. Confirm tables are created (run the verification queries at the bottom)

## 4. Run Django Migrations

```bash
# Django also needs its internal tables (auth, JWT blacklist, etc.)
python manage.py migrate

# If you see errors about existing tables, that's fine —
# the SQL schema handles our custom tables; Django handles its own.
```

## 5. Create the First Admin

```bash
python manage.py shell
```

```python
from apps.accounts.models import User, StaffIDRegistry

# 1. Add your own Staff ID to the registry first
StaffIDRegistry.objects.create(staff_id="S43-0001")

# 2. Create the admin user
user = User.objects.create_superuser(staff_id="S43-0001", password="your-secure-password")
user.is_first_login = False
user.save()

# 3. Create their member profile (optional for Admin — can do via API later)
exit()
```

## 6. Run Development Server

```bash
python manage.py runserver
```

API is live at: `http://localhost:8000/api/v1/`

## 7. Test Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"staff_id": "S43-0001", "password": "your-secure-password"}'
```

Expected response:
```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "role": "admin",
  "staff_id": "S43-0001",
  "is_first_login": false,
  "file_number": null,
  "full_name": null
}
```

## 8. Production (Railway / Render)

Set these environment variables in your hosting dashboard:
- `SECRET_KEY` — strong random key
- `DEBUG` — `False`
- `ENVIRONMENT` — `production`
- `DATABASE_URL` — Supabase URI (use Transaction Pooler port 6543 for Railway)
- `ALLOWED_HOSTS` — your Railway/Render domain
- `CORS_ALLOWED_ORIGINS` — your Vercel frontend URL

```bash
# Collect static files before deploy
python manage.py collectstatic --noinput
```

Procfile (for Railway/Render):
```
web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

## API Endpoints — Phase 1

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | /api/v1/auth/login/ | None | Login with Staff ID |
| POST | /api/v1/auth/refresh/ | None | Refresh JWT token |
| POST | /api/v1/auth/logout/ | Bearer | Logout (blacklist refresh) |
| POST | /api/v1/accounts/set-password/ | None | First login password setup |
| GET | /api/v1/accounts/me/ | Bearer | My own profile |
| GET | /api/v1/accounts/staff-ids/ | Admin | List staff ID registry |
| POST | /api/v1/accounts/staff-ids/ | Admin | Add Staff ID |
| PATCH | /api/v1/accounts/staff-ids/<id>/ | Admin | Update/deactivate Staff ID |
| GET | /api/v1/accounts/members/ | Admin/Committee/HOS | List all members |
| POST | /api/v1/accounts/members/ | Admin | Create member |
| GET | /api/v1/accounts/members/summary/ | Admin/Committee | Lightweight list |
| GET | /api/v1/accounts/members/<id>/ | Role-based | Member detail |
| PATCH | /api/v1/accounts/members/<id>/ | Admin | Update member |
| POST | /api/v1/accounts/members/<id>/approve/ | Admin | Approve membership |
| POST | /api/v1/accounts/members/<id>/deactivate/ | Admin | Deactivate member |
