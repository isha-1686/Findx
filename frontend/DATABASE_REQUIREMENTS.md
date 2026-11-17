# Database Requirements & Architecture Specification

This document details the database architecture, schema requirements, and storage design for the **AI-Based Online Lost & Found System** (as specified in the Literature Survey & System Design).

---

## 1. System Storage Overview

The system uses a **Hybrid Storage Model**:
1. **Relational Database** (currently powered by built-in zero-config **SQLite** at `backend/data/app.db`; easily portable to PostgreSQL / Supabase / MySQL):
   - Stores user accounts and authentication sessions.
   - Stores item reports with metadata (title, category, location, status, timestamps, contact info).
   - Stores pre-computed **512-dimensional L2-normalized visual feature embeddings** (`BLOB` or `pgvector` in PostgreSQL) for sub-millisecond similarity search.
2. **Object / File Storage** (`backend/data/uploads/` locally; or S3 / Supabase Storage in production):
   - Stores uploaded item photographs.
   - Serves public image URLs for UI rendering.

---

## 2. Relational Database Schema

### Table 1: `users`
Stores registered community members, campus security, or claimants.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` / `TEXT` | PRIMARY KEY | Unique user ID |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL | Account email address |
| `password_hash` | `TEXT` | NOT NULL | Salted PBKDF2-HMAC-SHA256 password hash |
| `display_name` | `VARCHAR(100)` | NULLABLE | Human-readable name or department title |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Registration timestamp |

---

### Table 2: `items`
Core entity storing all lost and found report submissions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` / `TEXT` | PRIMARY KEY | Unique item report identifier |
| `user_id` | `UUID` / `TEXT` | NOT NULL, FK(`users.id`) | Submitter ID (cascade on delete) |
| `type` | `VARCHAR(10)` | NOT NULL, CHECK in (`'lost'`, `'found'`) | Whether report is lost or found |
| `title` | `VARCHAR(120)` | NOT NULL | Short title (e.g. "Black Leather Wallet") |
| `description` | `TEXT` | NOT NULL | Detailed visual description & distinctive markings |
| `location` | `VARCHAR(200)` | NOT NULL | Campus / room / area location |
| `category` | `VARCHAR(50)` | NULLABLE | Classified category (`bag`, `book`, `card`, `earphone`, etc.) |
| `contact_info` | `VARCHAR(200)` | NULLABLE | Phone, email, or desk where claimant can reach poster |
| `image_path` | `TEXT` | NULLABLE | Local file system path or S3 key |
| `image_url` | `TEXT` | NULLABLE | Accessible HTTP URL to view photograph in frontend |
| `embedding` | `BLOB` / `vector(512)` | NULLABLE | 512-dim normalized ResNet18 feature vector |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT `'open'` | Status: `'open'`, `'resolved'`, or `'closed'` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Submission timestamp |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Last update timestamp |

---

### Table 3: `auth_tokens`
Stores active session tokens.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `token` | `VARCHAR(128)` | PRIMARY KEY | Secure URL-safe session token |
| `user_id` | `UUID` / `TEXT` | NOT NULL, FK(`users.id`) | Token owner |
| `created_at` | `TIMESTAMPTZ` | NOT NULL, DEFAULT NOW() | Token issuance timestamp |

---

## 3. Database Indexes (Performance Optimization)

To maintain real-time retrieval as reports grow:
```sql
CREATE INDEX idx_items_type_status ON items (type, status);
CREATE INDEX idx_items_user_id ON items (user_id);
CREATE INDEX idx_items_created_at ON items (created_at DESC);
CREATE INDEX idx_items_category ON items (category);
```

---

## 4. Production SQL Migration Script (PostgreSQL / Supabase Ready)

When you decide to deploy to a remote PostgreSQL or Supabase database, run this exact script:

```sql
-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Items Table
CREATE TABLE IF NOT EXISTS public.items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (type IN ('lost', 'found')),
    title         TEXT NOT NULL,
    description   TEXT NOT NULL,
    location      TEXT NOT NULL,
    category      TEXT,
    contact_info  TEXT,
    image_path    TEXT,
    image_url     TEXT,
    embedding     BYTEA, -- or vector(512) if using pgvector
    status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Auth Tokens Table
CREATE TABLE IF NOT EXISTS public.auth_tokens (
    token         TEXT PRIMARY KEY,
    user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS items_type_status_idx ON public.items (type, status);
CREATE INDEX IF NOT EXISTS items_created_at_idx ON public.items (created_at DESC);
CREATE INDEX IF NOT EXISTS items_user_id_idx ON public.items (user_id);
CREATE INDEX IF NOT EXISTS items_category_idx ON public.items (category);
```

