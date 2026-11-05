import { api } from "../../api/client";
import type {
  Asset,
  AssetListResponse,
  GetAssetsQuery,
  CreateAssetInput,
  UpdateAssetInput,
  AssignAssetInput,
  ReturnAssetInput,
  RetireAssetInput,
  AssetAssigneeUser,
} from "./types";

export const assetsApi = {
  list: async (params: GetAssetsQuery = {}): Promise<AssetListResponse> => {
    const res = await api.get<AssetListResponse>("/assets", { params });
    return res.data;
  },

  getAssets: async (params: GetAssetsQuery = {}): Promise<AssetListResponse> => {
    const res = await api.get<AssetListResponse>("/assets", { params });
    return res.data;
  },

  getMyAssets: async (): Promise<Asset[]> => {
    const res = await api.get<{ data: Asset[] }>("/assets/my");
    return res.data.data;
  },

  getById: async (id: string): Promise<Asset> => {
    const res = await api.get<Asset>(`/assets/${id}`);
    return res.data;
  },

  create: async (data: CreateAssetInput): Promise<Asset> => {
    const res = await api.post<Asset>("/assets", data);
    return res.data;
  },

  update: async (id: string, data: UpdateAssetInput): Promise<Asset> => {
    const res = await api.patch<Asset>(`/assets/${id}`, data);
    return res.data;
  },

  assign: async (id: string, data: AssignAssetInput): Promise<Asset> => {
    const res = await api.post<Asset>(`/assets/${id}/assign`, data);
    return res.data;
  },

  returnAsset: async (id: string, data: ReturnAssetInput = {}): Promise<Asset> => {
    const res = await api.post<Asset>(`/assets/${id}/return`, data);
    return res.data;
  },

  retire: async (id: string, data: RetireAssetInput = {}): Promise<Asset> => {
    const res = await api.post<Asset>(`/assets/${id}/retire`, data);
    return res.data;
  },

  getUsers: async (): Promise<AssetAssigneeUser[]> => {
    try {
      const res = await api.get<{ users: AssetAssigneeUser[] }>("/users", {
        params: { limit: 100 },
      });
      return res.data.users || [];
    } catch {
      // Fallback to directory endpoint if /users is restricted or empty
      try {
        const dirRes = await api.get<{ users: AssetAssigneeUser[] }>("/directory", {
          params: { limit: 100 },
        });
        return dirRes.data.users || [];
      } catch {
        return [];
      }
    }
  },

  getAssignableUsers: async (): Promise<AssetAssigneeUser[]> => {
    return assetsApi.getUsers();
  },
};
