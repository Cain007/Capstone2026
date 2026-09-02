# Next Steps Roadmap

## What is already in place

The current workspace already has a solid foundation:

- Frontend login and signup flow with token persistence in local or session storage.
- Backend auth API with `/api/auth/signup`, `/api/auth/login`, and `/api/auth/me`.
- JWT session handling and password hashing.
- Prisma + PostgreSQL user model and migration setup.
- A dashboard shell with navigation for Dashboard, Products, Categories, Suppliers, Inventory, Sales History, Forecasting, Reports, User Management, and Settings.

## Alignment check

The capstone document `FINAL-DAVO-BANES.docx` was checked from:

`F:\School Works 2025 -2026\2026 3rd 2nd Sem\Capstone\Chapters\FINAL-DAVO-BANES.docx`

The document describes an **Intelligent Inventory and Sales Forecasting System for King of Clouds - Vape Shop**. It expects the finished system to include:

- Admin and Staff login.
- Role-based access control.
- Product, category, supplier, inventory, sales, and report modules.
- Inventory updates after stock-in, stock-out, and sales.
- Sales recording with sale item details.
- Moving Average sales forecasting.
- Forecast and sales trend visualization.
- Inventory, sales, and forecast reports.
- PostgreSQL + Prisma data storage.

The workspace is aligned with the document's **technology direction and early structure**, but it is not yet aligned with the document's full functional claims. The current system is still at the foundation stage:

- Authentication exists.
- The protected dashboard shell exists.
- Dashboard pages for the expected modules exist.
- PostgreSQL and Prisma are configured.

The main gap is that the dashboard pages still use mock data, and the backend schema work still needs to be followed by finalized migrations, CRUD routes, inventory workflows, sales workflows, forecasting logic, and role-based permissions in the actual API.

## Documentation improvements needed

The documentation itself can be improved before defense or submission:

- Use one consistent project title throughout the manuscript. The cover says "Sales and Inventory System Implementing Predictive Analysis," while later sections use "Intelligent Inventory and Sales Forecasting System."
- Keep the technology stack consistent. Some parts mention Next.js, but the current workspace uses React with Vite, Node.js with Express, Prisma, and PostgreSQL.
- Fix visible formatting and typo issues, including missing spaces, repeated figure captions, repeated table captions, and the cover text typo around "Submitted."
- Update Chapter 3 and the test matrices only after the actual modules exist, so the paper does not claim completed functionality that is not implemented yet.
- Verify references and DOI links. Some references appear valid, but some citation entries and DOI links should be checked because they may point to unrelated articles or generic search pages.
- Add screenshots or appendices from the real system once the CRUD, sales, inventory, forecasting, and reporting modules are implemented.

## What to do next

### 1. Make the local environment fully runnable

Before building new features, make sure both apps start cleanly:

- Create and verify the PostgreSQL database.
- Set `backend/.env` with `DATABASE_URL`, `JWT_SECRET`, and `FRONTEND_URL`.
- Run Prisma generate and the migration.
- Confirm `npm run dev` works in both `backend` and `frontend`.
- Test `/api/health`, signup, login, and `/api/auth/me`.

### 2. Build the core data model

The capstone document's database schema expects more than a user table. The next backend work should add these Prisma models:

- Roles
- Users with role assignment
- Login history or audit trail
- Products
- Categories
- Suppliers
- Inventory transactions
- Sales
- Sale items
- Forecasts

Recommended next step:

- Add Prisma models for those entities.
- Add relationships and constraints that match the document's database schema.
- Create the corresponding API routes and controllers.
- Connect the routes to the dashboard pages one by one.

### 3. Turn dashboard placeholders into real CRUD screens

Right now the dashboard pages are mostly structured shells. The next frontend work should focus on:

- Listing records from the backend.
- Create, edit, and delete forms.
- Empty states, loading states, and error states.
- Consistent filters and search across modules.

Start with Products and Inventory first, because those usually drive the rest of the system.

### 4. Add business workflows

Once the base entities exist, implement the workflows the capstone likely expects:

- Stock receiving and stock deduction
- Stock adjustment history
- Low-stock alerts
- Sales logging with itemized sale records
- Automatic inventory deduction after a sale
- Report generation
- Moving Average forecasting based on sales history
- Forecast and trend visualization

### 5. Add permissions and account management

The current auth layer only distinguishes signed-in versus signed-out users. The capstone document specifically expects Admin and Staff access, so the system should include:

- Roles such as Admin and Staff
- Route protection based on role
- Staff access for inventory viewing and sales recording
- Admin access for sales, forecast, inventory, products, reports, and account management
- User management UI
- Password reset or account recovery if required by the brief
- Profile and settings controls

### 6. Finish with quality and deployment work

After the core features are in place, add:

- Form validation and better server error messages
- Unit or integration tests for auth and CRUD routes
- Seed data for demo and grading
- Deployment-ready environment setup
- Final documentation for setup and usage

## Suggested implementation order

1. Get both apps running locally without errors.
2. Finalize and apply Prisma migrations for the designed business models.
3. Add backend routes and controllers for Products and Categories.
4. Connect the Products and Categories pages to real data.
5. Add Suppliers and Inventory tracking.
6. Add Sales History and automatic stock deduction after each sale.
7. Add Moving Average forecasting from sales history.
8. Add Reports and trend visualizations.
9. Add Admin and Staff permissions.
10. Update the capstone document screenshots, test matrices, and implementation descriptions.
11. Polish, test, seed, and prepare for submission.

## Short version

If you want the fastest path forward, build in this order:

auth stability, capstone-aligned data models, CRUD screens, inventory workflows, sales recording, Moving Average forecasting, reporting, Admin/Staff permissions, document cleanup, then final polish.
