export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  unitType: string;
  price: string | number;
  cost: string | number | null;
  reorderPoint: number | null;
  categoryId: string;
  createdAt: string;
  updatedAt: string;
  category: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
};
