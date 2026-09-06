# API Reference

All routes except `/api/health` and `/api/auth/login` require a Bearer JWT unless noted.

## Auth

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Service health check |
| POST | `/api/auth/login` | Public | Sign in |
| GET | `/api/auth/me` | Authenticated | Load current user |
| POST | `/api/auth/change-password` | Authenticated | Change own password |

## Users

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/users` | Admin | List users |
| GET | `/api/users/:id` | Admin | Load one user |
| POST | `/api/users` | Admin | Create employee account |
| PUT | `/api/users/:id` | Admin | Update profile and role |
| PATCH | `/api/users/:id/status` | Admin | Change account status |
| POST | `/api/users/:id/reset-password` | Admin | Set temporary password |

## Catalog

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/categories` | Admin, Staff | List categories |
| GET | `/api/categories/:id` | Admin, Staff | Load one category |
| POST | `/api/categories` | Admin | Create category |
| PUT | `/api/categories/:id` | Admin | Update category |
| DELETE | `/api/categories/:id` | Admin | Delete/archive category |
| GET | `/api/products` | Admin, Staff | List products |
| GET | `/api/products/:id` | Admin, Staff | Load one product |
| POST | `/api/products` | Admin | Create product |
| PUT | `/api/products/:id` | Admin | Update product |
| DELETE | `/api/products/:id` | Admin | Delete/archive product |

## Suppliers And Inventory

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/suppliers` | Admin | List suppliers |
| GET | `/api/suppliers/:id` | Admin | Load one supplier |
| POST | `/api/suppliers` | Admin | Create supplier |
| PUT | `/api/suppliers/:id` | Admin | Update supplier |
| DELETE | `/api/suppliers/:id` | Admin | Delete/archive supplier |
| GET | `/api/inventory` | Admin | List inventory and stock health |
| GET | `/api/inventory/movements` | Admin | List stock movements |
| GET | `/api/inventory/:productId` | Admin | Load product inventory |
| POST | `/api/inventory/:productId/adjust` | Admin | Create stock adjustment |

## Sales, Forecasting, Procurement

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/sales` | Admin, Staff | List sales history |
| GET | `/api/sales/:id` | Admin, Staff | Load sale details |
| POST | `/api/sales` | Admin, Staff | Complete POS sale and deduct stock |
| POST | `/api/forecasts/products/:productId/generate` | Admin | Generate Moving Average forecast |
| GET | `/api/forecasts/products/:productId/latest` | Admin | Load latest forecast |
| GET | `/api/forecasts/products/:productId/insights` | Admin | Load predictive recommendation |
| GET | `/api/forecasts/products/:productId/evaluation/latest` | Admin | Evaluate matured forecast days |
| GET | `/api/purchase-orders` | Admin | List purchase orders |
| GET | `/api/purchase-orders/:id` | Admin | Load purchase order |
| POST | `/api/purchase-orders` | Admin | Create purchase order |
| POST | `/api/purchase-orders/:id/order` | Admin | Mark Draft as Ordered |
| POST | `/api/purchase-orders/:id/receive` | Admin | Receive items and increase stock |

## Dashboard, Reports, Audit

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/dashboard/admin` | Admin | Load dashboard summary |
| GET | `/api/reports/summary` | Admin | Load sales, inventory, and predictive reports |
| GET | `/api/audit-events` | Admin | List audit events |
| GET | `/api/security/login-history` | Admin | List login history |
