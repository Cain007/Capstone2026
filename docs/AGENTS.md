# Capstone Frontend Refactor Rules

Project:
Sales and Inventory System Implementing Predictive Analysis

Stack:
- React
- Vite
- TypeScript
- Node.js / Express backend
- Prisma + PostgreSQL
- JWT authentication
- Native fetch

PRIMARY GOAL:
Refactor the frontend into a consistent, professional retail inventory/SaaS interface without breaking existing working functionality.

STRICT RULES:

1. Inspect existing code before modifying it.

2. Do not modify backend files unless explicitly instructed.

3. Do not modify:
   - Prisma schema
   - migrations
   - backend API contracts
   - JWT/authentication behavior
   - existing request payloads

4. Existing working modules must remain functional:
   - Login/authentication
   - Categories CRUD
   - Products CRUD
   - Suppliers CRUD

5. Product image functionality currently remains frontend-only.
   Do not invent backend image persistence.

6. Do not introduce Product-Supplier relationships.

7. SupplierContact is outside the current CRUD scope.

8. Prefer reusable frontend components over duplicated page-specific UI.

9. Preserve native fetch unless explicitly approved otherwise.

10. Do not install large UI frameworks without approval.

11. Do not use:
   - excessive gradients
   - glassmorphism
   - neon/glowing UI
   - cyberpunk styling
   - oversized cards
   - excessive rounded corners
   - decorative animation

12. Visual direction:
   - professional enterprise SaaS
   - retail inventory / ERP
   - compact data density
   - restrained colors
   - consistent typography
   - strong information hierarchy

13. Desktop-first but responsive.

14. Work incrementally.

15. After every phase:
   - run lint
   - run TypeScript checks
   - run build
   - report exact files changed
   - report behavior preserved
   - stop for review before starting another major phase

16. Do not redesign multiple major modules in one uncontrolled change.

17. Never replace real API data with mock data.

18. Do not invent backend-supported features.

19. Existing branding should be preserved unless explicitly instructed otherwise.

20. If a requested UI requires missing backend functionality, document it instead of faking it.