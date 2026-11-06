# ShipGuard: Intelligent Parcel Protection & Automated Claims Platform

**ShipGuard** sits between e-commerce sellers and courier companies to solve package loss, damage disputes, prolonged claims (often 30–45 days), arbitrary denials, expensive insurance, and lack of carrier accountability.

---

## Key Architecture & Features

1. **Prevention via Dynamic Packaging Guidance**  
   Real-time packaging requirements update as sellers toggle fragility, category, and declared value (e.g., dual-side FRAGILE labels, anti-static ESD bags for electronics, mandatory pickup photos & tamper-evident tape for values > $500).

2. **Immutable Pickup Evidence Baseline**  
   Measured weight (kg), dimensions (LxWxH cm), condition (good, minor marks, damaged), and 1–3 photo references. Forms the tamper-proof baseline for automated comparison; only editable by ops admin with an audit note.

3. **Custody Telemetry & Scan-Gap Detection**  
   Courier scans append status, location notes, timestamps, scale weight, and shock impact readings in g-force.
   - Shock readings **$\ge$ 10.0g** trigger an automatic `"shock"` incident flag.
   - Delivered weight differing by **> 5%** from pickup weight triggers a `"weight_mismatch"` flag.
   - Background scan monitor flags **$\ge$ 2 days** inactivity with a `"warning"` alert and moves **$\ge$ 14 days** inactivity to `"lost"` status under the parametric loss rule.

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

## Project Structure

```
shipguard/
├── .env.example                 # Environment configuration template
├── package.json                 # Top-level unified scripts
├── README.md                    # Project documentation & demo guide
├── shared/
│   └── config/
│       └── constants.json       # Shared business rule thresholds & courier IDs
├── backend/
│   ├── requirements.txt         # Python dependencies (FastAPI, uvicorn, pydantic, bcrypt, etc.)
│   ├── pytest.ini               # Pytest configuration
│   ├── data/
│   │   ├── shipguard.db         # SQLite persistent database (WAL mode)
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

## Prerequisites & Installation

### Requirements
- **Node.js**: v18+ (tested on Node v24.20)
- **Python**: 3.10+ (tested on Python 3.13) with `pip`

### Single Setup Command
```bash
# 1. Install both frontend and backend dependencies (frontend packages & backend/requirements.txt)
npm run install:all

# 2. Seed database with demo accounts, couriers, 32 shipments, and sample photos
npm run seed
```

---

## Running the Application

### Option A: Run Full-Stack App (Backend Serving Production Frontend)
```bash
npm start
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

### Option B: Run in Development Mode (Vite Hot-Reload)
In terminal 1 (Backend API):
```bash
npm run start:backend
```
In terminal 2 (Vite Frontend):
```bash
npm run start:frontend
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## Running the Background Scan-Gap Scheduler

The scheduler evaluates active shipments for scan gaps:
- **$\ge 2$ days** without movement: marks as `"warning"`.
- **$\ge 14$ days** without movement: marks as `"lost"` and inserts a timeline event.

```bash
# Run one single evaluation cycle (ideal for cron or test):
npm run scheduler:once

# Run continuous hourly scheduler loop:
npm run scheduler
```
*Note: Ops admins can also trigger an immediate scan check at any time by clicking **"Run Hourly Check Now"** inside the Ops Dashboard Alerts tab.*

---

## Running Automated Tests

Run the full unit and integration test suite:
```bash
npm test
```
**Test Coverage Includes:**
- `tests/test_pricing.py`: Standard vs fragile rates, clean discount qualification ($< 2\%$ claims ratio), minimum premium floor ($0.50), packaging advice generator.
- `tests/test_claims.py`: Unit test coverage for every rule branch (a through f), coverage amount capping, and advance payouts.
- `tests/test_integration.py`: Complete end-to-end flow executing the 6 demo scenario steps, plus strict cross-seller RBAC and courier access enforcement.

---

## Pre-Seeded Demo Accounts

Every account uses the default password: **`password123`**.  
The top navigation bar also features a **"Demo Switcher"** for 1-click instant switching between all accounts without typing.

| Role | Account Name | Email | Key Capabilities |
|---|---|---|---|
| **Seller** (Clean Record) | Apex Electronics | `apex@seller.com` | Qualifies for 20% clean discount; books shipments, records pickups, files claims |
| **Seller** | Nova Retail | `nova@seller.com` | Standard seller account with mixed shipment states |
| **Courier Staff** | Dave Miller (FastEx) | `staff@fastex.com` | Authorized to scan FastEx parcels with weight & shock readings |
| **Courier Staff** | Emma Watson (SwiftPost)| `staff@swiftpost.com` | Authorized to scan SwiftPost parcels |
| **Courier Staff** | Carlos Vega (CityLink) | `staff@citylink.com` | Authorized to scan CityLink parcels |
| **Ops Admin** | Sarah Connor | `admin@shipguard.com`| Scan-gap alert queue, claim decisions (approve/deny/arbitrate), scorecards, settings |

---

## End-to-End Demo Walkthrough

1. **Book Protected Parcel with Clean Discount**
   - Log in as **Apex Electronics** (`apex@seller.com`).
   - Click **"+ Book Protected Parcel"**.
   - Select **FastEx**, category **Electronics**, toggle **Fragile: ON**, declared value **$800.00**, toggle **ShipGuard Protection: ON**.
   - Observe the live quote breakdown: Base rate $0.8\% = \$6.40$, Seller Clean Record discount of $20\% = -\$1.28$, Final Premium = **\$5.12** ($6.40 before discount).
   - Observe real-time packaging guidance: Anti-static ESD bags, dual-side FRAGILE stickers, and high-value security advisory ($> \$500$).
   - Click **"Confirm & Book Shipment"**.

2. **Record Pickup Evidence Baseline**
   - On the newly created shipment detail page, click **"Record Pickup Evidence"**.
   - Enter weight **2.00 kg**, dimensions **30x20x15**, condition **Good (Flawless)**.
   - Verify 2 photos are attached (pre-filled or upload photos).
   - Click **"Lock In Baseline Evidence"**. Notice status moves to `picked_up`.

3. **Log Courier Hub Scan with Shock Impact**
   - Click the **Demo Switcher** in the top navigation and select **FastEx Staff** (`staff@fastex.com`).
   - The courier terminal opens. Locate your shipment and click **"Scan Parcel"**.
   - Select status **At Hub**, location **FastEx Central Sorting Hub #4**, and enter shock impact **12.0 g** (or click the quick pre-fill button).
   - Click **"Transmit Scan Telemetry"**.
   - Inspect the timeline: notice the bright orange **`FLAGGED: Impact Shock (>= 10g)`** irregularity badge.

4. **File Damage Claim with Instant Telemetry Auto-Approval**
   - Switch back to **Apex Electronics** via the Demo Switcher.
   - Open your shipment and click **"File Protection Claim"**.
   - Select **Damage in Transit**, claimed amount **$600.00**, enter description (or click the quick demo prefill button).
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
   - Click **"Deny"**, enter the audit reason:  
     `"Inspection confirmed pre-existing manufacturer defect, not transit handling."`
   - Click **"Record Decision & Log"**.
   - Switch to the **Audit Log** tab: confirm the entry appears with timestamp, action `claim_denied`, actor `Sarah Connor (USR-ADMIN)`, and audit details.

---

## Assumptions & Design Choices

- **Persistent Embedded Database**: SQLite in WAL mode with foreign key constraints enabled is used to ensure instant single-command setup without requiring an external PostgreSQL daemon on Windows/macOS. All queries use parameterized statements.
- **Parametric Loss Rule**: Parcels inactive for $\ge 14$ days are marked lost by the hourly background job and auto-approved if a loss claim is filed.
- **Evidence Immutability**: Pickup baseline records are locked against edits; admin supersedes are recorded with an audit note and preserved in the audit log.
- **Mobile-First Scanning**: Dedicated courier terminal optimized for touch targets and mobile screens.

