export type AuditEventType =
  | 'DATA_CHANGE'
  | 'ADMIN_ACTION'
  | 'ACCESS_CONTROL'
  | 'SECURITY'
  | 'REPORTING'
  | 'SYSTEM';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'ASSIGN_ROLE'
  | 'REVOKE_ROLE'
  | 'GRANT_PERMISSION'
  | 'REVOKE_PERMISSION'
  | 'EXPORT'
  | 'IMPORT'
  | 'VIEW'
  | 'APPROVE'
  | 'CANCEL';

export type AuditEntityType =
  | 'USER'
  | 'ROLE'
  | 'PERMISSION'
  | 'PRODUCT'
  | 'CATEGORY'
  | 'SUPPLIER'
  | 'PURCHASE_ORDER'
  | 'INVENTORY'
  | 'SALE'
  | 'FORECAST_RUN'
  | 'REPORT'
  | 'SYSTEM';

export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'DENIED';

export type AuthEventType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_COMPLETE'
  | 'SESSION_EXPIRED';

export type AuthEventStatus = 'SUCCESS' | 'FAILURE' | 'DENIED';

export type AuthFailureReason =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_NOT_FOUND'
  | 'ACCOUNT_DISABLED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'RATE_LIMITED'
  | 'PASSWORD_POLICY'
  | 'USER_NOT_AUTHENTICATED'
  | 'UNKNOWN';

export type AuditActor = {
  id: string | null;
  email: string;
  fullName: string | null;
  username: string | null;
  role: string | null;
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type PaginationMetadata = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type AuditEventRecord = {
  id: string;
  eventType: AuditEventType;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string | null;
  entityLabel: string | null;
  status: AuditStatus;
  actor: AuditActor | null;
  actorUserIdSnapshot: string | null;
  actorEmailSnapshot: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  before: JsonValue;
  after: JsonValue;
  metadata: JsonValue;
  createdAt: string;
};

export type LoginHistoryRecord = {
  id: string;
  eventType: AuthEventType;
  status: AuthEventStatus;
  failureReason: AuthFailureReason | null;
  user: AuditActor | null;
  actorUserIdSnapshot: string | null;
  actorEmailSnapshot: string | null;
  attemptedEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: JsonValue;
  createdAt: string;
};

export type AuditListResponse = {
  items: AuditEventRecord[];
  pagination: PaginationMetadata;
};

export type LoginHistoryListResponse = {
  items: LoginHistoryRecord[];
  pagination: PaginationMetadata;
};
