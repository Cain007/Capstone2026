declare global {
  namespace Express {
    interface Request {
      userId?: string;
      authUser?: {
        id: string;
        role: string;
        status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      };
    }
  }
}

export {};
