export type Supplier = {
  id: string;
  supplierCode: string;
  name: string;
  legalName: string | null;
  status: 'ACTIVE' | 'ON_HOLD' | 'INACTIVE' | 'ARCHIVED';
  email: string | null;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};