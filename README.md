# Sales and Inventory System Implementing Predictive Analysis

## Overview

This project is a web-based sales and inventory system for retail operations. It combines point-of-sale transaction processing, inventory monitoring, reorder support, procurement, reporting, audit logging, and Moving Average predictive analysis.

The system supports:

- POS sales with cash received and change due.
- Automatic stock deduction from completed sales.
- Product, category, supplier, inventory, and stock movement management.
- Moving Average demand forecasting using completed sales history.
- Predictive reorder recommendations and forecast evaluation.
- Purchase order creation, order marking, and receiving.
- Admin dashboard, reports, audit logs, and login history.
- JWT authentication, bcrypt password hashing, and Admin/Staff role-based access.

## Roles

Admin users manage the full system: dashboard, catalog, suppliers, inventory, stock movements, sales history, forecasting, purchase orders, reports, user management, audit logs, and account settings.

Staff users focus on daily operations: POS, sales history, read-only product/category reference, and account settings.

Accounts are managed by administrators. There is no public signup flow.

## Technology Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js, Express, TypeScript, Prisma
- Database: PostgreSQL
- Authentication: JWT, bcrypt

## Core Workflow

POS Sale -> Stock Deduction -> Forecast -> Predictive Insight -> Purchase Order -> Receiving -> Stock Increase -> Audit -> Dashboard/Reports

## Quick Start

Use [docs/SETUP.md](docs/SETUP.md) to prepare PostgreSQL, configure environment variables, apply migrations, seed roles or demo data, and run both applications.

## Documentation

- [Setup](docs/SETUP.md)
- [User Guide](docs/USER_GUIDE.md)
- [Defense Demo](docs/DEFENSE_DEMO.md)
- [Deployment](docs/DEPLOYMENT.md)
- [API](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Test Evidence](docs/TEST_EVIDENCE.md)
- [Final Readiness Roadmap](docs/NEXT_STEPS_ROADMAP.md)
