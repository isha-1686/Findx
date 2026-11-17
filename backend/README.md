# Lost & Found – Python Backend

AI-powered backend for the lost & found platform. Built with **FastAPI** + **ResNet18** (PyTorch) + **Supabase**.

---

## How it works

1. Users submit a **lost** or **found** report with a photo + description + location
2. Images are stored in **Supabase Storage**; metadata goes into the **Supabase Postgres** `items` table
3. When a user searches, their photo is run through a fine-tuned **ResNet18** that:
   - Classifies the item into one of 10 categories
   - Extracts a 512-dim visual embedding (feature vector)
4. That embedding is compared via **cosine similarity** against all opposite-type items in the DB
5. Matches are ranked by **85% visual similarity + 15% category match** and returned as a ranked list

---

## Setup

### 1. Create & activate virtual environment

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### 2. Install dependencies

```bash
# CPU-only PyTorch (default):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt

# GPU (CUDA 12.1):
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your Supabase keys (see .env.example for instructions)
```

### 4. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `sql_migration.sql` in the **SQL Editor**
3. Create a **private** Storage bucket named `item-images`
4. Copy your **Project URL** and **service_role key** into `.env`

### 5. Train the AI model

```bash
# Place dataset images in: data/raw/<category>/<images>
# Categories: bag, book, card, earphone, key, lipstick, phone, umbrella, USBflashdisk, vacuumcup

python -m app.ml.train
# → Saves: data/models/best_model.pth
# → Saves: data/models/class_names.json
```

### 6. Run the API

```bash
python run.py
# or:
uvicorn app.main:app --reload --port 8000
```

API docs available at: **http://localhost:8000/docs**

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/ml/status` | Model load status + classes |
| `POST` | `/api/v1/ml/predict-category` | Classify an image (no auth required for testing) |
| `POST` | `/api/v1/reports` | Create a lost/found report (auth required) |
| `GET` | `/api/v1/reports` | List open reports (optional ?type=lost&category=bag) |
| `GET` | `/api/v1/reports/{id}` | Get a single report (auth required) |
| `PATCH` | `/api/v1/reports/{id}/status` | Update report status (owner only) |
| `DELETE` | `/api/v1/reports/{id}` | Delete a report (owner only) |
| `POST` | `/api/v1/matching/search` | AI match: upload image → get top-K matches |
| `GET` | `/api/v1/matching/item/{id}` | AI match for a stored item by ID |
| `POST` | `/api/v1/matching/item/{id}/confirm/{matched_id}` | Confirm a match as the source report owner and resolve both reports |

---

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── matching.py     # AI similarity search endpoints
│   │   ├── ml.py           # Model status & predict endpoints
│   │   └── reports.py      # CRUD for lost/found reports
│   ├── core/
│   │   ├── auth.py         # Supabase JWT auth dependency
│   │   ├── config.py       # Settings from .env
│   │   └── supabase_client.py  # Supabase client singleton
│   ├── ml/
│   │   ├── model.py        # ResNet18 model definition + predictor
│   │   ├── train.py        # Training script
│   │   └── evaluate.py     # Evaluation script (classification report)
│   ├── schemas/
│   │   └── items.py        # Pydantic schemas
│   ├── services/
│   │   └── storage.py      # Image upload/download/delete
│   └── main.py             # FastAPI app factory
├── data/
│   ├── raw/                # Training images (gitignored)
│   └── models/             # Trained weights (gitignored)
├── .env                    # Your secrets (gitignored)
├── .env.example            # Template
├── requirements.txt
├── run.py                  # Dev server launcher
└── sql_migration.sql       # Database setup SQL
```

---

## Evaluate the model

```bash
python -m app.ml.evaluate
# Prints per-class precision/recall/F1 + confusion matrix
```

