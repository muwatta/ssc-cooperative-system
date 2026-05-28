CREATE TYPE user_role AS ENUM ('admin', 'committee', 'head_of_school', 'staff');
CREATE TYPE marital_status AS ENUM ('single', 'married', 'divorced', 'widowed');
CREATE TYPE gender_type AS ENUM ('male', 'female');
CREATE TYPE membership_status AS ENUM ('pending', 'active', 'inactive', 'exited');
CREATE TYPE school_branch AS ENUM ('primary', 'college', 'other');



CREATE TABLE ssc_staff_id_registry (
    id          BIGSERIAL PRIMARY KEY,
    staff_id    VARCHAR(10)  NOT NULL UNIQUE,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by_id BIGINT     REFERENCES ssc_users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT staff_id_format CHECK (staff_id ~ '^S[0-9]{2}-[0-9]{4}$')
);

CREATE INDEX idx_staff_id_registry_staff_id ON ssc_staff_id_registry(staff_id);


CREATE TABLE ssc_users (
    id              BIGSERIAL PRIMARY KEY,
    staff_id        VARCHAR(10)   NOT NULL UNIQUE,
    password        VARCHAR(128)  NOT NULL,
    role            user_role     NOT NULL DEFAULT 'staff',
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    is_staff        BOOLEAN       NOT NULL DEFAULT FALSE,
    is_superuser    BOOLEAN       NOT NULL DEFAULT FALSE,
    is_first_login  BOOLEAN       NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT staff_id_format CHECK (staff_id ~ '^S[0-9]{2}-[0-9]{4}$')
);

CREATE INDEX idx_ssc_users_staff_id ON ssc_users(staff_id);
CREATE INDEX idx_ssc_users_role ON ssc_users(role);

ALTER TABLE ssc_staff_id_registry
    ADD CONSTRAINT fk_registry_created_by
    FOREIGN KEY (created_by_id) REFERENCES ssc_users(id) ON DELETE SET NULL;


CREATE TABLE ssc_member_profiles (
    id                          BIGSERIAL PRIMARY KEY,
    user_id                     BIGINT        NOT NULL UNIQUE REFERENCES ssc_users(id) ON DELETE RESTRICT,
    file_number                 VARCHAR(10)   NOT NULL UNIQUE,
    _file_sequence              INTEGER       NOT NULL UNIQUE,

    -- Personal
    full_name                   VARCHAR(255)  NOT NULL,
    phone_primary               VARCHAR(20)   NOT NULL,
    phone_secondary             VARCHAR(20)   NOT NULL DEFAULT '',
    marital_status              marital_status NOT NULL,
    gender                      gender_type   NOT NULL,
    date_of_birth               DATE          NOT NULL,
    place_of_birth              VARCHAR(255)  NOT NULL,

    -- School
    school_branch               school_branch NOT NULL,
    designation                 VARCHAR(255)  NOT NULL,
    date_joined_school          DATE          NOT NULL,

    -- Financial
    monthly_income              NUMERIC(12,2) NOT NULL,
    approved_monthly_contribution NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Contact
    residential_address         TEXT          NOT NULL,
    permanent_home_address      TEXT          NOT NULL,
    email_address               VARCHAR(254)  NOT NULL DEFAULT '',
    social_media_handle         VARCHAR(100)  NOT NULL DEFAULT '',

    -- Origin
    state_of_origin             VARCHAR(100)  NOT NULL,
    local_government_area       VARCHAR(100)  NOT NULL,

    -- Next of Kin
    next_of_kin_name            VARCHAR(255)  NOT NULL,
    next_of_kin_address         TEXT          NOT NULL,
    next_of_kin_phone           VARCHAR(20)   NOT NULL,
    next_of_kin_relationship    VARCHAR(100)  NOT NULL,
    next_of_kin_place_of_work   VARCHAR(255)  NOT NULL DEFAULT '',

    -- Membership status
    membership_status           membership_status NOT NULL DEFAULT 'pending',
    is_legacy                   BOOLEAN       NOT NULL DEFAULT FALSE,

    -- Official approval fields
    approved_by_name            VARCHAR(255)  NOT NULL DEFAULT '',
    officer_in_charge           VARCHAR(255)  NOT NULL DEFAULT '',
    approval_date               DATE,

    -- Savings tenure tracker (SRS M1, M2, S5)
    consecutive_savings_months  INTEGER       NOT NULL DEFAULT 0,

    created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT file_number_format CHECK (file_number ~ '^A[0-9]+$'),
    CONSTRAINT min_contribution CHECK (approved_monthly_contribution >= 0)
);

CREATE INDEX idx_member_profiles_file_number ON ssc_member_profiles(file_number);
CREATE INDEX idx_member_profiles_membership_status ON ssc_member_profiles(membership_status);
CREATE INDEX idx_member_profiles_school_branch ON ssc_member_profiles(school_branch);
CREATE INDEX idx_member_profiles_full_name ON ssc_member_profiles(full_name);


CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ssc_users_updated_at
    BEFORE UPDATE ON ssc_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_id_registry_updated_at
    BEFORE UPDATE ON ssc_staff_id_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_profiles_updated_at
    BEFORE UPDATE ON ssc_member_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


ALTER TABLE ssc_staff_id_registry DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssc_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE ssc_member_profiles DISABLE ROW LEVEL SECURITY;
