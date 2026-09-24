# Frontend

React/Vite frontend for KING OF CLOUDS VAPE SHOP inventory, sales, and forecasting management.

Production deployment targets Node 24.x and Vercel builds from the `frontend`
root with `npm ci`, `npm run build`, and `dist` as the output directory.

## Environment

Copy `.env.example` to `.env` and set:

```text
VITE_API_URL="http://localhost:5000"
```

The value should be the backend origin only. Frontend pages append `/api/...` in fetch calls.

## Install

```powershell
npm install
```

## Development

```powershell
npm run dev
```

Vite normally serves the app at `http://localhost:5173`.

## Build

```powershell
npm run lint
npx tsc -p tsconfig.app.json --noEmit --incremental false
npm run build
```

## Major Pages

Admin navigation includes Dashboard, Products, Categories, Suppliers, Purchase Orders, Inventory, Stock Movements, Sales History, Forecasting, Reports, User Management, Audit Logs, and Account & System.

Staff navigation includes POS, Sales History, Products, Categories, and Account & System.

There is no public signup page. Accounts are created by an Admin in User Management.
