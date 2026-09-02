export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};