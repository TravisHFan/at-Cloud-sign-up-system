import { BaseApiClient } from "./common";
import type {
  AnnualMembership,
  AnnualMembershipPayload,
} from "../../types/annualMembership";

function normalizeMembership(raw: AnnualMembership): AnnualMembership {
  const id = raw.id || raw._id || "";
  return {
    ...raw,
    id,
    programs: (raw.programs || []).map((program) => ({
      ...program,
      id: program.id || program._id || "",
    })),
  };
}

class AnnualMembershipsApiClient extends BaseApiClient {
  async list(params?: {
    programId?: string;
    q?: string;
  }): Promise<AnnualMembership[]> {
    const search = new URLSearchParams();
    if (params?.programId) search.set("programId", params.programId);
    if (params?.q) search.set("q", params.q);
    const qs = search.toString();
    const res = await this.request<AnnualMembership[]>(
      `/annual-memberships${qs ? `?${qs}` : ""}`,
    );
    return (res.data || []).map(normalizeMembership);
  }

  async getById(id: string): Promise<AnnualMembership> {
    const res = await this.request<AnnualMembership>(
      `/annual-memberships/${id}`,
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to load annual membership.");
    }
    return normalizeMembership(res.data);
  }

  async create(payload: AnnualMembershipPayload): Promise<AnnualMembership> {
    const res = await this.request<AnnualMembership>("/annual-memberships", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to create annual membership.");
    }
    return normalizeMembership(res.data);
  }

  async update(
    id: string,
    payload: AnnualMembershipPayload,
  ): Promise<AnnualMembership> {
    const res = await this.request<AnnualMembership>(
      `/annual-memberships/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    if (!res.data) {
      throw new Error(res.message || "Failed to update annual membership.");
    }
    return normalizeMembership(res.data);
  }

  async createCheckoutSession(id: string): Promise<{
    sessionId: string;
    sessionUrl: string;
    purchaseId: string;
    orderNumber: string;
  }> {
    const res = await this.request<{
      sessionId: string;
      sessionUrl: string;
      purchaseId: string;
      orderNumber: string;
    }>(`/annual-memberships/${id}/checkout`, {
      method: "POST",
    });
    if (!res.data) {
      throw new Error(res.message || "Failed to start membership checkout.");
    }
    return res.data;
  }
}

const annualMembershipsApiClient = new AnnualMembershipsApiClient();

export const annualMembershipsService = {
  list: (params?: Parameters<typeof annualMembershipsApiClient.list>[0]) =>
    annualMembershipsApiClient.list(params),
  getById: (id: string) => annualMembershipsApiClient.getById(id),
  create: (payload: AnnualMembershipPayload) =>
    annualMembershipsApiClient.create(payload),
  update: (id: string, payload: AnnualMembershipPayload) =>
    annualMembershipsApiClient.update(id, payload),
  createCheckoutSession: (id: string) =>
    annualMembershipsApiClient.createCheckoutSession(id),
};

export const annualMembershipService = annualMembershipsService;
