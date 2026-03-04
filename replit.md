# BudgetFlow - Personal Budgeting App

## Overview
A personal budgeting webapp with dark mode styling, hardcoded auth, and JSON file storage.

## Architecture
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: Express with session-based auth (memorystore)
- **Storage**: JSON files in `data/` directory (no database)
- **Auth**: Hardcoded credentials (JonahTheEngi / BobTheBuilder1!)

## Key Features
- Pay schedule configuration (7/14 day intervals) with payday prompt
- Monthly expense management with categories (fixed + variable)
- Variable spending system: Groceries and Fun Money are permanent non-deletable expenses with monthly budget caps; individual charges logged via "Add Charge" with per-month tracking
- Dashboard is current-month only: "Estimated vs Actual" bar chart (income + savings groups), spending donut chart, variable spending progress bars, savings goals progress
- Savings goals with allocation sliders and progress tracking
- History tab (route: /history) shows past completed months only (excludes current month); empty state when no past months exist

## Actual Pay Tracking
- "I Got Paid" button on dashboard lets user record actual paycheck amounts
- Stored in `data/actual-pay.json` as array of `{ id, amount, date, month, note? }`
- When actual pay is recorded for a month, dashboard uses actual income instead of estimated for remaining calculation
- Monthly Income card shows actual total vs estimated, with paycheck count
- Paycheck history expandable under stat cards with delete option
- Dashboard chart: "Estimated vs Actual" grouped bar chart showing Income (estimated vs actual) and Savings (expected vs actual)
- History page has monthly trends bar chart (income/expenses/net) that appears when 2+ past months exist

## Variable Spending System
- Expenses with `isVariable: true` are special categories (Groceries, Fun Money)
- They cannot be deleted, only edited (budget amount adjustable)
- Charges stored in `data/variable-charges.json` as `{ [month]: { [expenseId]: VariableCharge[] } }`
- Variable expense IDs: Groceries = `43a5023e-246d-4555-9a61-b55d272f7a06`, Fun Money = `fe16e523-cbfb-47a6-bcf8-eb706e999e19`
- Budget calculations include both fixed entries AND variable actual spending for accurate remaining

## File Structure
- `shared/schema.ts` - Zod schemas and TypeScript types
- `server/storage.ts` - JSON file storage (reads/writes to `data/`)
- `server/routes.ts` - Express API routes with session auth
- `client/src/pages/` - Dashboard, Expenses, History (budget.tsx), Savings, Login
- `client/src/components/` - AppSidebar, PayScheduleModal
- `data/` - JSON data files (expenses, budget-history, pay-schedule, savings-goals, variable-charges)

## Running
- `npm run dev` starts Express + Vite dev server on port 5000

## Docker Deployment
- `Dockerfile` — multi-stage build (builder compiles frontend + backend, production image runs `dist/index.cjs`)
- `docker-compose.yml` — defines the service with a named `budgetflow-data` volume mounted at `/app/data` for persistent JSON storage
- `.dockerignore` — excludes node_modules, dist, .git from build context
- Deploy via `docker compose up -d` or import the compose stack into Portainer
- Set `SESSION_SECRET` to a secure random string in the compose environment
- The `data/` volume starts empty; the app auto-creates JSON files on first use
