# Polymarket Signal Visualizer MVP

A signal-driven visualizer for Polymarket that surfaces abnormal market movements.

## Features
- **Signal Feed**: Ranked list of markets with significant probability shifts.
- **Explainability**: Text-based explanations for why a market is flagged.
- **Deep Dive**: Modal view showing historical probability snapshots and volume context.
- **Abnormal Movement Detection**: Rule-based engine calculating movement scores (Z-score inspired delta).

## Tech Stack
- **Backend**: FastAPI (Python), SQLite, SQLAlchemy, Pandas.
- **Frontend**: Next.js (TypeScript), TailwindCSS, Glassmorphism UI.

## How to Run Locally

### 1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt  # (or install fastapi uvicorn requests pandas sqlalchemy)
export PYTHONPATH=$PYTHONPATH:.
python3 app/main.py
```
The backend will automatically start polling Polymarket Gamma API and saving snapshots to `polymarket_visual.db`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Known Limitations / MVP Notes
- This MVP tracks binary markets primarily (Yes/No outcomes).
- Signals require at least 2 snapshots to calculate delta (wait ~5-10 mins after first start).
- Data polling is currently set to 5-minute intervals.
- The "Signal Explanation" is currently rule-based and template-driven.
