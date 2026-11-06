# 🛡️ ShipGuard: Intelligent Parcel Protection & Automated Claims Platform

**ShipGuard** sits between e-commerce sellers and courier networks to eliminate package loss disputes, prolonged claims (typically 30–45 days), arbitrary denials, expensive insurance premiums, and carrier unaccountability.

---

## 📌 Problem & Solution Overview

### The Problem
- **Prolonged Claim Disputes**: Traditional courier claim procedures require 30 to 45 business days of manual back-and-forth review.
- **Arbitrary Denials**: Couriers frequently reject claims under vague pretexts such as *"insufficient packaging"* or *"pre-existing damage"*, leaving sellers to absorb 100% of the loss.
- **Custody "Black Holes"**: Once a package enters transit, neither seller nor courier has objective, timestamped telemetry showing exactly *where* or *when* an impact or loss occurred.
- **Excessive Insurance Margins**: Standard shipping insurance charges 1.5%–3.0% of item value with high deductibles and adversarial claim processes.

### How ShipGuard Solves It
1. **Dynamic Packaging Guidance (Prevention)**: Before shipping, ShipGuard generates tailored packaging compliance rules based on category, value, and fragility.
2. **Immutable Pickup Evidence Baseline**: The seller records weight, dimensions, condition, and photos before dispatch. This baseline is tamper-proof and locks the pre-transit state.
3. **Custody Telemetry & Scan Gaps**: Courier transit scans capture timestamps, locations, scale weights, and g-force shock impacts ($\ge 10g$ automatically flags a transit irregularity; $>5\%$ weight deviation flags potential pilferage).
4. **Parametric & Telemetry Claims Engine**: Objective claims are evaluated in milliseconds via sequential deterministic rules (a through f). If custody telemetry proves shock or a 14-day scan gap, payouts are **auto-approved instantly**.
5. **Carrier Accountability Scorecard**: Aggregates incident rates per 1,000 shipments across carriers, giving merchants leverage to route volume through top-performing couriers.

---

## 🏗️ System Architecture & Workflow

```text
  [ Seller App ]                [ Courier Hub Terminal ]             [ Ops Dashboard ]
         │                                  │                                │
 1. Book Parcel & Quote                     │                                │
    + Packaging Advice                      │                                │
         │                                  │                                │
 2. Record Baseline                         │                                │
    (Weight, Dim, Photos)                   │                                │
         │                                  │                                │
         └─────────────► 3. Custody Scans ──┘                                │
                            + Shock Telemetry (>=10g)                        │
                            + Scale Weight Checks                            │
                                    │                                        │
                         4. Background Monitor                               │
                            - 2d gap: Warning Alert                          │
                            - 14d gap: Parametric Lost ─────────────────────►│
                                    │                                        │
 5. File Protection Claim ──────────┼───────────────────────────────────────►│
         │                          ▼                                        │
         └───────────────► [ Claims Engine ] ───────────────────────────────►│
                           Rules a - f Evaluation                            │
                           ├── Auto-Approve (Instant Payout)                 │
                           ├── 50% Advance Payout                            │
                           └── Fraud / Manual Review ───────────────────────►│
                                                                       6. Adjudicate &
                                                                          Audit Log
```

---

## 🚀 Key Features

1. **Dynamic Packaging Guidance**  
   Real-time packaging requirements adapt as sellers toggle fragility, item category, and declared value (e.g., dual-side FRAGILE labels, anti-static ESD bags for electronics, mandatory pickup photos & tamper-evident tape for values > $500).

2. **Immutable Pickup Baseline**  
   Captured weight (kg), dimensions (LxWxH cm), condition (good, minor marks, damaged), and 1–3 photo references. Forms the tamper-proof baseline for automated comparison; only editable by ops admin with an audit note.

3. **Custody Telemetry & Scan-Gap Detection**  
   Courier scans append status, location notes, timestamps, scale weight, and shock impact readings in g-force.
   - Shock readings **$\ge$ 10.0g** trigger an automatic `"shock"` incident flag.
   - Delivered weight differing by **> 5%** from pickup weight triggers a `"weight_mismatch"` flag.
   - Background scan monitor flags **$\ge$ 2 days** inactivity with a `"warning"` alert and marks **$\ge$ 14 days** inactivity as `"lost"` under the parametric loss rule.

4. **Transparent, Configurable Per-Shipment Protection**  
   - Standard goods: **0.4%** of declared value.
   - Fragile goods: **0.8%** of declared value.
   - Minimum premium floor: **$0.50**.
   - Clean seller discount: **20% off** for sellers maintaining a claims-to-shipments ratio under 2%.
   - Uninsured parcels default to the configurable courier liability cap (**$100.00**).
   - All rates and caps are dynamically configurable in the database `settings` table.

5. **Parametric & Evidence-Based Claims Engine**  
   Strict sequential rule evaluation on claim submission:
   - **Rule a**: Seller with $\ge 3$ claims in last 90 days $\rightarrow$ status `"fraud_review"`.
   - **Rule b**: Type is loss and shipment is marked delivered $\rightarrow$ status `"denied"` (*"Delivery scan on record; proof of non-delivery required"*).
   - **Rule c**: Type is loss and last scan is $\ge 14$ days old $\rightarrow$ status `"auto_approved"` under parametric loss rule.
   - **Rule d**: Type is damage, pickup record exists, and shipment has `"shock"` or `"weight_mismatch"` flag $\rightarrow$ status `"auto_approved"`.
   - **Rule e**: Claimed amount $\le \$50$, insured, and pickup record exists $\rightarrow$ status `"auto_approved"`.
   - **Rule f**: Otherwise status `"under_review"`. If insured, issues immediate **50% advance payout**; otherwise $0 payout.

6. **Ops Decisions & Immutable Audit Trail**  
   Ops admins can approve (with custom adjusted amount), deny, or hold in arbitration. Every decision, setting modification, and baseline correction is logged to `audit_log` with admin identity and timestamp.

7. **Courier Accountability Scorecard**  
   Aggregates total shipments, lost count, damage claims, **incidents per 1,000 shipments** ($((lost + damage) / shipments) \times 1,000$), and average decision hours with a date filter (`30d`, `90d`, `all`).

---

## 📁 Project Structure

```
shipguard/
├── .env.example                 # Environment configuration template
├── .gitignore                   # Clean git ignore rules (ignores .env and SQLite binaries)
├── package.json                 # Top-level unified scripts
├── README.md                    # Project documentation & demo guide
├── run_app.bat                  # One-click Windows starter batch script
├── run_app.ps1                  # One-click PowerShell starter script
├── shared/
│   └── config/
│       └── constants.json       # Shared business rule thresholds & courier IDs
├── backend/
│   ├── requirements.txt         # Python dependencies (FastAPI, uvicorn, pydantic, bcrypt, etc.)
│   ├── pytest.ini               # Pytest configuration
│   ├── data/
│   │   ├── shipguard.db         # SQLite persistent database (WAL mode, ignored in git)
│   │   └── uploads/             # Verified photo upload storage
│   ├── tests/
│   │   ├── test_pricing.py      # Unit tests: rates, clean discounts, advice
│   │   ├── test_claims.py       # Unit tests: rules a through f & coverage capping
│   │   └── test_integration.py # Integration test: full 6-step demo & RBAC
│   └── app/
│       ├── config.py            # JWT secret, file paths, CORS
│       ├── database.py          # SQLite schema, foreign keys, settings defaults
│       ├── models.py            # Pydantic request & response validation schemas
│       ├── scheduler.py         # Hourly background scan-gap & loss monitor
│       ├── seed.py              # Realistic seed data script
│       ├── main.py              # FastAPI server, static SPA mount, error handling
│       ├── services/
│       │   ├── auth_service.py  # Bcrypt hashing, JWT tokens, sliding-window rate limit
│       │   ├── pricing_service.py # Live quote calculation & packaging guidance
│       │   ├── claims_service.py  # Parametric claims decision engine (rules a-f)
│       │   ├── alerts_service.py  # Scan gaps, lost marking & scorecard analytics
│       │   └── audit_service.py   # Immutable audit log recorder
│       └── routers/
│           ├── auth.py          # /api/auth/signup, /login, /logout, /me
│           ├── couriers.py      # /api/couriers (list & admin PATCH)
│           ├── settings.py      # /api/settings (admin GET & PUT)
│           ├── quote.py         # /api/quote
│           ├── shipments.py     # /api/shipments (CRUD, pickups, scans, timeline)
│           ├── claims.py        # /api/claims (file, list, get, ops decision)
│           ├── alerts.py        # /api/alerts & manual trigger
│           ├── scorecard.py     # /api/scorecard?range=30d|90d|all
│           ├── uploads.py       # /api/uploads (5MB limit, image MIME check)
│           └── audit.py         # /api/audit (ops inspection)
└── frontend/
    ├── package.json             # React 19, Vite, Tailwind CSS v4, Lucide icons
    ├── vite.config.js           # Dev server with reverse proxy to FastAPI
    ├── index.html
    └── src/
        ├── main.jsx
        ├── index.css
        ├── api.js               # Centralized API client & JWT token management
        ├── App.jsx              # Application router & 1-click demo switcher
        └── components/
            ├── Navbar.jsx       # Header & quick demo role switcher
            ├── AuthView.jsx     # Login, Signup, demo buttons
            ├── SellerDashboard.jsx # Active shipments, alert banners, seller score
            ├── BookingForm.jsx  # Live quote breakdown & dynamic packaging advice
            ├── ShipmentDetail.jsx # Custody timeline, pickup baseline, flags, claim
            ├── PickupModal.jsx  # Mobile-first pickup check & photo uploader
            ├── CourierScanModal.jsx # Mobile-first scan logger & shock impact meter
            ├── ClaimModal.jsx   # Claim form & instant decision outcome card
            ├── CourierHubView.jsx # Dedicated mobile courier dispatch terminal
            ├── OpsDashboard.jsx # 4 Panels: Alerts, Claims, Scorecard, All Parcels
            └── SettingsModal.jsx # Admin rates, thresholds & carrier fleet editor
```

---

## 🛠️ Prerequisites & Installation

### Requirements
- **Node.js**: v18+ (tested on Node v20/v24)
- **Python**: 3.10+ (tested on Python 3.11/3.13) with `pip`

### Step 1: Single Unified Dependency Installation
```bash
npm run install:all
```
*(Installs both frontend NPM packages and `backend/requirements.txt` via pip).*

### Step 2: Seed the Database
```bash
npm run seed
```
*(Seeds demo accounts, couriers, 32 realistic test shipments with telemetry, and sample upload photos).*

---

## 💻 Running the Application

### Option A: Run Full-Stack (One Command)
```bash
npm start
```
Or double-click `run_app.bat` (on Windows).  
Visit **[http://localhost:8000](http://localhost:8000)** in your browser.

### Option B: Run in Development Mode (Vite Hot-Reload)
In Terminal 1 (Backend API):
```bash
npm run start:backend
```
In Terminal 2 (Vite Frontend with proxy to backend):
```bash
npm run start:frontend
```
Visit **[http://localhost:5173](http://localhost:5173)** in your browser.

### Option C: Deploy to Vercel (Multi-Service Project)
ShipGuard includes root `vercel.json` configured for Vercel Services:
- **Backend Service**: FastAPI (`backend/`, mapped to `/api/(.*)` and `/uploads/(.*)`)
- **Frontend Service**: Vite React SPA (`frontend/`, mapped to `/(.*)`)

Deploy directly with Vercel CLI or connect your GitHub repository:
```bash
vercel
```

---

## ⏱️ Background Scan-Gap Scheduler

The scheduler continuously evaluates in-flight shipments for movement inactivity:
- **$\ge 2$ days** without movement: triggers a `"warning"` alert in Ops Dashboard.
- **$\ge 14$ days** without movement: marks the shipment as `"lost"` and triggers parametric auto-approval eligibility.

```bash
# Run one single evaluation cycle (ideal for cron or CI):
npm run scheduler:once

# Run continuous hourly scheduler loop:
npm run scheduler
```
*Note: Ops admins can also trigger an immediate check anytime using the **"Run Hourly Check Now"** button in Ops Dashboard.*

---

## 🧪 Automated Testing

Execute the complete backend pytest suite:
```bash
npm test
```
Or directly:
```bash
cd backend && pytest -v
```

**Test Coverage Highlights:**
- `tests/test_pricing.py`: Standard vs fragile rates, clean discount qualification ($< 2\%$ claims ratio), minimum premium floor ($0.50), packaging advice generator.
- `tests/test_claims.py`: Unit tests for every rule branch (a through f), coverage amount capping, and advance payouts.
- `tests/test_integration.py`: End-to-end integration test validating the entire 6-step lifecycle and strict RBAC isolation.

---

## 👥 Pre-Seeded Demo Accounts

Every pre-seeded account uses default password: **`password123`**.  
The top navigation bar features a **"Demo Switcher"** for 1-click instant switching between accounts.

| Role | Account Name | Email | Key Capabilities |
|---|---|---|---|
| **Seller** (Clean Record) | Apex Electronics | `apex@seller.com` | 20% clean discount, books shipments, records pickups, files claims |
| **Seller** | Nova Retail | `nova@seller.com` | Standard seller account with mixed shipment states |
| **Courier Staff** | Dave Miller (FastEx) | `staff@fastex.com` | Authorized to scan FastEx parcels with scale weight & shock telemetry |
| **Courier Staff** | Emma Watson (SwiftPost)| `staff@swiftpost.com` | Authorized to scan SwiftPost parcels |
| **Courier Staff** | Carlos Vega (CityLink) | `staff@citylink.com` | Authorized to scan CityLink parcels |
| **Ops Admin** | Sarah Connor | `admin@shipguard.com`| Scan-gap alert queue, claim decisions (approve/deny/arbitrate), scorecards, settings |

---

## 🎬 6-Step End-to-End Demo Walkthrough

1. **Book Protected Parcel with Clean Discount**
   - Log in as **Apex Electronics** (`apex@seller.com`).
   - Click **"+ Book Protected Parcel"**.
   - Select **FastEx**, category **Electronics**, toggle **Fragile: ON**, declared value **$800.00**, toggle **ShipGuard Protection: ON**.
   - Live quote reflects: Base rate $0.8\% = \$6.40$, Seller Clean Record discount of $20\% = -\$1.28$, Final Premium = **\$5.12**.
   - Packaging guidance alerts: Anti-static ESD bags, dual-side FRAGILE stickers, and high-value security advisory ($> \$500$).
   - Click **"Confirm & Book Shipment"**.

2. **Record Pickup Evidence Baseline**
   - On the shipment detail page, click **"Record Pickup Evidence"**.
   - Enter weight **2.00 kg**, dimensions **30x20x15**, condition **Good (Flawless)**.
   - Attach 2 photos (pre-filled or uploaded).
   - Click **"Lock In Baseline Evidence"** (status moves to `picked_up`).

3. **Log Courier Hub Scan with Shock Impact**
   - Click the **Demo Switcher** in the top navigation and select **FastEx Staff** (`staff@fastex.com`).
   - Find your shipment and click **"Scan Parcel"**.
   - Select status **At Hub**, location **FastEx Central Sorting Hub #4**, and enter shock impact **12.0 g**.
   - Click **"Transmit Scan Telemetry"**.
   - Inspect the timeline: observe the bright orange **`FLAGGED: Impact Shock (>= 10g)`** badge.

4. **File Damage Claim with Instant Telemetry Auto-Approval**
   - Switch back to **Apex Electronics** via the Demo Switcher.
   - Open your shipment and click **"File Protection Claim"**.
   - Select **Damage in Transit**, claimed amount **$600.00**, description (or click the quick prefill button).
   - Click **"Evaluate & Submit Claim"**.
   - **Result**: Claim is immediately **AUTO-APPROVED** under **Rule d** (*"Auto-approved via transit telemetry: pickup baseline verified and impact shock (>=10g) detected in transit"*).
   - Approved amount shows **$600.00**, and **$600.00 immediate payout** is disbursed now.

5. **Inspect 15-Day Inactive Parcel in Ops Alert Queue & Scorecard**
   - Switch to **Sarah Connor (Ops Admin)** (`admin@shipguard.com`).
   - The **Alerts Queue** displays pre-seeded parcel **`SHP-LOST15D`** as **Parametric Lost** (15+ days without scan activity).
   - Switch to the **Courier Scorecard** tab: confirm FastEx reflects the lost count and computed incident rate per 1,000 shipments.

6. **Adjudicate Claim & Verify Immutable Audit Log**
   - In Ops Dashboard, click the **Claims Decisions** tab.
   - Select claim **`CLM-REV001`** (Under Review).
   - Click **"Deny"**, enter audit reason: `"Inspection confirmed pre-existing manufacturer defect, not transit handling."`
   - Click **"Record Decision & Log"**.
   - Switch to the **Audit Log** tab: confirm the entry appears with timestamp, action `claim_denied`, actor `Sarah Connor (USR-ADMIN)`, and audit details.

---

## 🌐 GitHub Repository & Cloning

The project is hosted on GitHub at [https://github.com/Adityax2711/Shipguard](https://github.com/Adityax2711/Shipguard).

### Cloning the Project
```bash
git clone https://github.com/Adityax2711/Shipguard.git
cd Shipguard
```

---

## 🔒 Security & Configuration Notes

- `.env` holds the deployment secrets (`JWT_SECRET`, database paths) and is excluded from Git tracking via `.gitignore`.
- SQLite database binaries (`*.db`, `*.db-wal`, `*.db-shm`) are excluded from Git to prevent committing local state or locks.
- CORS origins in `backend/app/config.py` enforce explicit localhost origins without wildcard conflicts when `allow_credentials=True` is enabled.
