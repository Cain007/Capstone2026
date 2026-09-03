type StatusBadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const statusLabels: Record<string, string> = {
  ACTIVE: 'Active',
  DRAFT: 'Draft',
  ARCHIVED: 'Archived',
  DISCONTINUED: 'Discontinued',
  ON_HOLD: 'On Hold',
  INACTIVE: 'Inactive',
};

export function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function statusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'DRAFT':
    case 'ON_HOLD':
      return 'warning';
    case 'DISCONTINUED':
      return 'danger';
    case 'ARCHIVED':
    case 'INACTIVE':
      return 'neutral';
    default:
      return 'info';
  }
}
