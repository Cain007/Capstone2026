export type HelpTopicId =
  | 'getting-started' | 'pos' | 'inventory-health' | 'moving-average'
  | 'forecast-evaluation' | 'purchase-orders' | 'reports' | 'administration' | 'account-security';

export type HelpItem = {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
  facts?: Array<{ label: string; text: string }>;
  formula?: string;
  keywords?: string;
};

export type HelpCategory = {
  id: HelpTopicId;
  title: string;
  summary: string;
  adminOnly?: boolean;
  items: HelpItem[];
};

// Explanations follow the current workflow and calculation helpers; no calculations run here.
export const guide: HelpCategory[] = [
  {
    id: 'getting-started', title: 'Getting Started', summary: 'Your workspace, roles, and first sign-in.',
    items: [
      { id: 'system-overview', title: 'What is the KING OF CLOUDS VAPE SHOP system?', paragraphs: ['Inventory, Sales & Forecasting Management brings together product records, sales, stock monitoring, supplier purchasing, and demand forecasting. Your navigation shows the workspace for your role.'] },
      { id: 'roles', title: 'What can Admin and Staff access?', paragraphs: ['Admin navigation includes Dashboard, Products, Categories, Suppliers, Inventory, Stock Movements, Sales History, Predictive Analysis, Reports, Purchase Orders, User Management, Audit Logs, Account & System, and this guide.', 'Staff navigation includes POS, Sales History, Products, Categories, Account & System, and this guide. Staff can browse Products and Categories; management actions belong to Admin. POS is the Staff landing workspace; Admin lands on Dashboard.'], keywords: 'permissions role access read only' },
      { id: 'sign-in', title: 'How do I log in, use Remember Me, and log out?', paragraphs: ['Sign in with your email or username and password. If a password change is required, complete it before entering your workspace.', 'Remember Me keeps your sign-in available across browser sessions until it expires or you log out. Without it, sign-in is kept for the browser session. Use it only on a trusted device.', 'Open the account menu at the top of the page and choose Logout. Logout is also available in the mobile navigation.'], keywords: 'login remember me session logout' },
      { id: 'referenced-records', title: "Why can't I delete a referenced product, category, or supplier?", paragraphs: ['Some records cannot be deleted because existing system records reference them. This preserves those relationships. Ask an Admin to review the record and its available status options; do not remove transaction history just to delete a master record.'], keywords: 'delete referenced records archive' },
    ],
  },
  {
    id: 'pos', title: 'Sales & POS', summary: 'Cart, payment, transaction completion, and sales history.',
    items: [
      { id: 'process-sale', title: 'How do I process a sale?', paragraphs: ['In the Staff POS workspace, use the product browser and Current Sale checkout.'], steps: ['Search by product name, SKU, or category; use Category and Sort as needed.', 'Choose Add on an available product. Out-of-stock products cannot be added.', 'Use Minus and Plus to adjust quantities within available stock, or remove a line.', 'Review the total. Expand Discount and customer details when needed.', 'Choose the payment method. For Cash, enter Cash Received and review Change Due.', 'Choose Complete Sale. Wait for the completion message before starting the next transaction.'], keywords: 'add cart quantity remove checkout sale' },
      { id: 'cash-payment', title: 'Which payments are supported, and how is change shown?', paragraphs: ['The payment choices are Cash, Card, E-Wallet, Bank Transfer, and Other. Selecting a method records that choice; the page does not provide a separate payment-provider checkout.', 'Cash Received must be a valid amount covering the total. Insufficient cash blocks completion. Change Due is cash received minus the total. For non-cash payments, cash tender and change are not collected.'], keywords: 'cashReceivedCents changeDueCents insufficient cash payment' },
      { id: 'sale-stock-effect', title: 'Why did inventory change after a sale?', paragraphs: ['A completed sale deducts the sold quantities from inventory and records stock movements. After success, the cart is cleared and product/inventory data refreshes.', 'If stock has changed before completion, the sale can be rejected and inventory refreshed. Review the remaining quantities and the error message before trying again.'] },
      { id: 'sales-history', title: 'How do I review Sales History?', paragraphs: ['Staff sees My Sales History for their own transactions. Admin can review broader sales history. Use search, payment, status, date, and sort controls to find a transaction.', 'Choose View to inspect line items, totals, date, cashier, and payment details. Cash Received and Change Due appear when the transaction has cash tender data. Missing tender values are not treated as zero.'], keywords: 'transaction reference receipt details' },
    ],
  },
  {
    id: 'inventory-health', title: 'Inventory & Stock Health', summary: 'Current quantity, reorder points, adjustments, and movements.', adminOnly: true,
    items: [
      { id: 'inventory-basics', title: 'What are current quantity and reorder point?', paragraphs: ['Current quantity is the stock presently recorded for a product. Reorder point is the configured stock threshold used for static stock health and static reorder recommendations.', 'Static health uses current quantity and reorder point, not sales forecasts. Predictive risk instead estimates how long current stock may last using forecast daily demand.'], keywords: 'static predictive difference currentStock' },
      { id: 'stock-health-rules', title: 'How are stock-health labels assigned?', paragraphs: ['Out of Stock takes priority at zero quantity. For positive stock, a missing reorder point gives Not Configured; otherwise the thresholds below apply. A configured reorder point of zero is not the same as a missing value.'], facts: [
        { label: 'Out of Stock', text: 'Current quantity = 0.' },
        { label: 'Not Configured', text: 'Current quantity > 0 and reorder point is not configured.' },
        { label: 'Critical', text: 'Current quantity > 0 and current quantity <= floor(reorderPoint / 2).' },
        { label: 'Low', text: 'Current quantity > floor(reorderPoint / 2) and current quantity <= reorderPoint.' },
        { label: 'Healthy', text: 'Current quantity > reorderPoint.' },
      ], keywords: 'OUT_OF_STOCK CRITICAL LOW HEALTHY UNCONFIGURED floor threshold' },
      { id: 'not-configured', title: 'Why is a product marked Not Configured?', paragraphs: ['It has positive stock but no reorder point. An Admin can review the reorder point in Products. Without that setting, a static reorder recommendation is unavailable. Zero stock is still shown as Out of Stock.'] },
      { id: 'static-reorder', title: 'What does the static reorder recommendation mean?', paragraphs: ['It is the quantity needed to bring current stock up to the configured reorder point, never below zero. It is unavailable without a reorder point. This differs from predictive reorder, which uses expected demand over a forecast horizon.'], formula: 'max(reorderPoint - currentStock, 0)' },
      { id: 'stock-movements', title: 'How do adjustments and Stock Movements work?', paragraphs: ['Admin can use Adjust Stock from Inventory to record an adjustment. Review the product, quantity, and adjustment information before submitting.', 'Sales decrease stock, purchase-order receiving increases it, and manual adjustments change it. Stock Movements records the direction, quantity, type, and available reference/context so changes can be traced.'] },
    ],
  },
  {
    id: 'moving-average', title: 'Predictive Analysis', summary: 'Moving Average, history windows, forecast horizons, and predictive risk.', adminOnly: true,
    items: [
      { id: 'moving-average-method', title: 'How is this forecast calculated?', paragraphs: ['Predictive Analysis projects product demand from completed sales using a Moving Average. Choose an active product, a Historical Window, and a Forecast Horizon.', 'The historical period ends yesterday in Manila business dates and starts no earlier than the product creation date. Calendar days without sales count as zero demand. Total quantity sold is divided by the observed days; this average becomes predicted daily demand.', 'The same daily value is projected across the forecast horizon, starting tomorrow. This is a fixed Moving Average projection, without seasonal or recursive modeling.'], formula: 'Average daily demand = total completed quantity sold / observed calendar days', keywords: 'moving average flat forecast calculation zero sales calendar days' },
      { id: 'window-horizon', title: 'What are Historical Window and Forecast Horizon?', paragraphs: ['Both offer 7, 14, or 30 days. Historical Window selects how much past demand is averaged. Forecast Horizon selects how many future days are projected.', 'Changing the horizon changes the length of the projection and horizon demand, not the daily Moving Average formula.'], keywords: '7 14 30 window horizon future history' },
      { id: 'flat-forecast', title: 'Why is my forecast flat?', paragraphs: ['Every projected day uses the same average daily demand from the selected history. A flat line is expected for this Moving Average method; it does not model daily seasonality.'] },
      { id: 'limited-history', title: 'What do limited history, NO_HISTORY, and zero demand mean?', paragraphs: ['Limited history means fewer observed calendar days are available than the selected window, because the product was created more recently.', 'NO_HISTORY means no completed historical business day is available in the usable interval, for example a product created today. It does not simply mean the product has never sold.', 'When observed days exist but there are no completed sales during them, demand is zero. Those zero-sales days remain part of the average.'], keywords: 'NO_HISTORY limited history NO_DEMAND' },
      { id: 'predictive-risk', title: 'How does predictive inventory risk differ from stock health?', paragraphs: ['Predictive risk uses current stock and average daily demand, independently of the static reorder point. Zero stock takes priority, then missing or zero demand, then coverage thresholds.'], facts: [
        { label: 'Out of Stock', text: 'Current stock is zero.' },
        { label: 'No Forecast', text: 'Positive stock with no available average daily demand.' },
        { label: 'No Demand', text: 'Positive stock and average daily demand is zero.' },
        { label: 'Critical', text: 'Positive demand with stock coverage of 3 days or less.' },
        { label: 'At Risk', text: 'Stock coverage is more than 3 days and at most 7 days.' },
        { label: 'Stable', text: 'Stock coverage is more than 7 days.' },
      ], keywords: 'OUT_OF_STOCK NO_FORECAST NO_DEMAND CRITICAL AT_RISK STABLE static health' },
      { id: 'stockout', title: 'What are Days Remaining and Estimated Stockout?', paragraphs: ['Days Remaining estimates how long current stock lasts at the forecast average daily demand. With positive stock and zero or unavailable demand, coverage is unavailable. Zero stock has zero days remaining.', 'Estimated Stockout uses this coverage, rounded up to a whole day from the current Manila date. It is an estimate, not a guaranteed date; changes in demand, sales, receiving, or adjustments affect the situation.'], formula: 'Days remaining = currentStock / averageDailyDemand' },
      { id: 'predictive-reorder', title: 'How is predictive reorder quantity calculated?', paragraphs: ['Expected horizon demand is average daily demand multiplied by horizon days, rounded to two decimals. Predictive reorder subtracts current stock, rounds the shortage up to whole units, and never recommends a negative quantity. It is unavailable when horizon demand is unavailable.', 'It is a purchasing recommendation, not an automatic order or stock adjustment.'], formula: 'max(ceil(forecastHorizonDemand - currentStock), 0)', keywords: 'predictive reorder ceil horizon demand recommendation' },
    ],
  },
  {
    id: 'forecast-evaluation', title: 'Forecast Evaluation', summary: 'Matured dates, MAE, WAPE, and forecast bias.', adminOnly: true,
    items: [
      { id: 'evaluation-ready', title: 'What are matured forecast dates, and why is evaluation Not Ready?', paragraphs: ['Evaluation compares saved predictions with actual completed product sales for forecast dates that have already passed in Manila business time. Today and future dates are not yet matured.', 'A matured date with no completed sales contributes zero actual demand; a sale is not required for the date to be evaluated. NOT_READY means no matured forecast dates are available for comparison.'], keywords: 'NOT_READY matured periods actual zero sales readiness' },
      { id: 'mae', title: 'What is MAE?', paragraphs: ['Mean Absolute Error is the average absolute difference between predicted and actual daily demand. It is measured in quantity units per day, not percent. Lower values generally indicate closer predictions.'], formula: 'MAE = sum(abs(predicted - actual)) / evaluated days' },
      { id: 'wape', title: 'What is WAPE, and why can it be unavailable?', paragraphs: ['Weighted Absolute Percentage Error compares total absolute forecast error with total actual demand across evaluated dates.', 'When total actual demand is zero, WAPE is unavailable. That is not a 0% error result.'], formula: 'WAPE = sum(abs(predicted - actual)) / sum(actual) * 100', keywords: 'WAPE unavailable percentage totalActual zero' },
      { id: 'bias', title: 'What do Mean Error and Bias Direction mean?', paragraphs: ['The error convention is predicted minus actual. Mean Error averages those signed differences.', 'Positive mean error means Over Forecast; negative means Under Forecast; exactly zero is Balanced. A value close to zero suggests little net directional bias, but positive and negative errors can cancel, so also review MAE.'], formula: 'Error = predicted - actual', keywords: 'MEAN_ERROR OVER_FORECAST UNDER_FORECAST BALANCED bias' },
    ],
  },
  {
    id: 'purchase-orders', title: 'Procurement', summary: 'Purchase orders, statuses, and receiving stock.', adminOnly: true,
    items: [
      { id: 'purchase-order-flow', title: 'How do I create and order a purchase order?', paragraphs: ['Choose New Purchase Order, select an active supplier and product items, enter ordered quantities and unit costs, and review the subtotal. Expected delivery and notes are optional.', 'Create as Draft for review, or as Ordered. A Draft can be marked as Ordered through the confirmation action. Review the details carefully before ordering.'], keywords: 'purchase orders create supplier PO draft ordered' },
      { id: 'purchase-order-statuses', title: 'What do purchase-order statuses mean?', paragraphs: ['The status controls which actions are available. Draft orders are not receivable.'], facts: [
        { label: 'Draft', text: 'Prepared for review before being marked as ordered.' },
        { label: 'Ordered', text: 'Marked as ordered and eligible for receiving.' },
        { label: 'Partially Received', text: 'Some ordered units have arrived; others are outstanding.' },
        { label: 'Received', text: 'All ordered quantities have been received.' },
        { label: 'Cancelled', text: 'An existing status shown by the system; not eligible for receiving. This page does not offer a cancellation action.' },
      ], keywords: 'DRAFT ORDERED PARTIALLY_RECEIVED RECEIVED CANCELLED' },
      { id: 'receiving', title: 'Why did inventory change after receiving a PO?', paragraphs: ['Receive is available for Ordered and Partially Received orders. Review Ordered, Previously Received, Remaining, and Receive Now quantities.', 'Enter delivered whole-unit quantities without exceeding what remains, then choose Record Receipt. Partial receipts leave outstanding quantities; completing all quantities marks the order Received.', 'Receiving adds the accepted quantities to inventory and records the corresponding stock movement. If the order changed meanwhile, review any error and the refreshed remaining quantities before retrying.'] },
    ],
  },
  {
    id: 'reports', title: 'Reports', summary: 'Date ranges, sales trend, top products, and current stock snapshots.', adminOnly: true,
    items: [
      { id: 'report-periods', title: 'Which report information follows the date filters?', paragraphs: ['Sales summaries, Sales Trend, and Top Products use the selected Manila business-date period and completed sales.', 'Inventory Health is a current stock snapshot, not historical stock as of the selected dates. Predictive inventory information uses current stock and the latest saved product forecasts; do not read it as a historical inventory snapshot.'] },
      { id: 'sales-trend', title: 'What does Sales Trend show?', paragraphs: ['Sales Trend shows completed sales across the selected period. Tooltips show Revenue, Transactions, and Units Sold for the date. Days without sales remain in the trend.'] },
      { id: 'top-products', title: 'How are Top Products ranked?', paragraphs: ['Top Products ranks products by quantity sold during the selected report period. The table provides exact quantities and revenue where available. Revenue and quantity are different measures.'] },
      { id: 'inventory-health-report', title: 'Is Inventory Health predictive?', paragraphs: ['No. It groups current products by static stock-health categories using current quantity and reorder point. Forecast-based risk is a separate measure.'], keywords: 'current snapshot static inventory health' },
    ],
  },
  {
    id: 'administration', title: 'Users & Audit', summary: 'Employee access, temporary passwords, activity, and login history.', adminOnly: true,
    items: [
      { id: 'user-management', title: 'How do I manage employee accounts and roles?', paragraphs: ['Create User creates a Staff account with identity details, a temporary password, and an account status. Use Edit User to change identity or assign Admin or Staff as allowed by the system.', 'Active accounts can sign in. Inactive and Suspended accounts are blocked. Status changes require confirmation, and the system protects the last active Admin account.', 'There is no permanent account-delete action.'], keywords: 'user management create staff admin role ACTIVE INACTIVE SUSPENDED' },
      { id: 'password-reset', title: 'How do temporary passwords and password resets work?', paragraphs: ['An Admin sets and confirms a temporary password when creating an account or using Reset Password. The employee must change it on next login.', 'Reset Password does not send a recovery email. Handle temporary credentials privately and ask the employee to complete the required password change.'], keywords: 'mustChangePassword temporary reset credentials' },
      { id: 'audit', title: 'What do Activity and Login History record?', paragraphs: ['Activity lists recorded administrative and operational events with the actor, action, entity, result, and available details. View Details shows stored before/after information and context when present.', 'Login History shows recorded authentication activity and access attempts, with Success, Failure, or Denied results and available account, reason, IP, and browser details. Use the existing filters and pagination to locate records.'], keywords: 'audit logs login history SUCCESS FAILURE DENIED' },
    ],
  },
  {
    id: 'account-security', title: 'Account & Password', summary: 'Required password changes, account access, and forgotten passwords.',
    items: [
      { id: 'change-password', title: 'How do I change my password?', paragraphs: ['If the system requires a password change, enter your current temporary password, a new password, and its confirmation before continuing.', 'For a regular change, open Account & System. Enter Current Password, New Password, and Confirm New Password, then choose Change Password. The new password must have at least eight characters, match its confirmation, and differ from the current password.'], keywords: 'forced password change account security temporary password' },
      { id: 'forgot-password', title: 'What happens if I forget my password?', paragraphs: ['Contact your administrator for assistance with account access or a temporary password reset. There is no self-service password recovery in this application. Do not share your password in audit notes or transaction notes.'], keywords: 'forgot password recovery reset login' },
      { id: 'blocked-account', title: 'Why can an inactive or suspended account not sign in?', paragraphs: ['Inactive and Suspended accounts are blocked from signing in. Staff should contact the administrator to review their account status. Changing a password does not itself reactivate an account.'] },
    ],
  },
];

export function matchesHelp(category: HelpCategory, item: HelpItem, query: string): boolean {
  const text = [category.title, category.summary, item.title, ...item.paragraphs, ...(item.steps ?? []),
    ...(item.facts ?? []).flatMap(fact => [fact.label, fact.text]), item.formula, item.keywords].join(' ').toLowerCase();
  return query.trim().toLowerCase().split(/\s+/).every(word => text.includes(word));
}
