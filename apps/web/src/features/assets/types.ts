export type AssetType = "LAPTOP" | "MONITOR" | "PHONE" | "LICENSE" | "ACCESSORY";

export type AssetStatus = "AVAILABLE" | "ASSIGNED" | "IN_REPAIR" | "RETIRED";

export interface AssetAssigneeUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  department?: {
    id: string;
    name: string;
  } | null;
}

export interface AssetAssignment {
  id: string;
  assetId: string;
  userId: string;
  user: AssetAssigneeUser;
  assignedAt: string;
  returnedAt?: string | null;
  assignedById: string;
  assignedBy: {
    id: string;
    name: string;
    email: string;
  };
  requestId?: string | null;
  request?: {
    id: string;
    title: string;
    category: string;
    status: string;
  } | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  serialNumber?: string | null;
  status: AssetStatus;
  purchaseDate?: string | null;
  warrantyExpiresAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  assignments: AssetAssignment[];
  currentAssignment?: AssetAssignment | null;
}

export interface GetAssetsQuery {
  page?: number;
  limit?: number;
  search?: string;
  type?: AssetType;
  status?: AssetStatus;
  warranty?: "all" | "expired" | "expiring_soon" | "valid";
  requestId?: string;
  sortBy?: "createdAt" | "name" | "type" | "status" | "warrantyExpiresAt";
  sortOrder?: "asc" | "desc";
}

export interface AssetPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AssetListResponse {
  data: Asset[];
  pagination: AssetPagination;
}

export interface CreateAssetInput {
  name: string;
  type: AssetType;
  serialNumber?: string | null;
  status?: AssetStatus;
  purchaseDate?: string | null;
  warrantyExpiresAt?: string | null;
  notes?: string | null;
}

export interface UpdateAssetInput {
  name?: string;
  type?: AssetType;
  serialNumber?: string | null;
  status?: AssetStatus;
  purchaseDate?: string | null;
  warrantyExpiresAt?: string | null;
  notes?: string | null;
}

export interface AssignAssetInput {
  userId: string;
  requestId?: string | null;
  notes?: string | null;
}

export interface ReturnAssetInput {
  notes?: string | null;
}

export interface RetireAssetInput {
  notes?: string | null;
}
