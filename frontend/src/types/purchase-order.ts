export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ORDERED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type PurchaseOrderUser = {
  id: string;
  email: string;
  fullName: string | null;
  username: string | null;
};

export type PurchaseOrderSupplier = {
  id: string;
  supplierCode: string;
  name: string;
  status?: string;
};

export type PurchaseOrderItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantityOrdered: number;
  quantityReceived: number;
  remainingQuantity: number;
  unitCostCents: number;
  lineTotalCents: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PurchaseOrderSummary = {
  id: string;
  poNumber: string;
  supplier: PurchaseOrderSupplier;
  status: PurchaseOrderStatus;
  subtotalCents: number;
  itemCount: number;
  orderedAt: string | null;
  expectedDeliveryDate: string | null;
  receivedAt: string | null;
  createdAt: string;
  createdBy: PurchaseOrderUser | null;
};

export type PurchaseOrderDetail = PurchaseOrderSummary & {
  cancelledAt: string | null;
  notes: string | null;
  updatedAt: string;
  updatedBy: PurchaseOrderUser | null;
  items: PurchaseOrderItem[];
};

export type PurchaseOrderCreateRequest = {
  supplierId: string;
  status: 'DRAFT' | 'ORDERED';
  expectedDeliveryDate?: string;
  notes?: string;
  items: Array<{
    productId: string;
    quantityOrdered: number;
    unitCostCents: number;
  }>;
};

export type PurchaseOrderReceiveRequest = {
  items: Array<{
    purchaseOrderItemId: string;
    quantityReceived: number;
  }>;
  note?: string;
};

export type SupplierOption = {
  id: string;
  supplierCode: string;
  name: string;
  status: 'ACTIVE' | 'ON_HOLD' | 'INACTIVE' | 'ARCHIVED';
};

export type ProductOption = {
  id: string;
  sku: string;
  name: string;
  status: string;
  cost: string | number | null;
};

export type PurchaseOrderPrefill = {
  productId: string;
  quantityOrdered: number;
  source: 'PREDICTIVE_ANALYSIS';
  productName?: string;
  sku?: string;
};
