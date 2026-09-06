export type UserRole = 'Admin' | 'Staff';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type User = {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
};

export type AuthResponse = {
  token: string;
  user: User;
  defaultRoute: 'Dashboard' | 'POS';
};
