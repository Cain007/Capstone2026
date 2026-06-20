export type User = {
  id: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};
