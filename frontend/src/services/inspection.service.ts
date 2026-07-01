import api from '../lib/axios';
import { InspectionTransaction } from '../types';

export interface SubmitInspectionDto {
  shiftId: string;
  partId: string;
  operationId: string;
  lotNumber: string;
  mcNo: string;
  intervalName: string;
  remarks: string | null;
  details: {
    parameterId: string;
    observedValue: string;
  }[];
}

export const inspectionService = {
  checkDue: async (params: { partId: string; operationId: string; shiftId: string; intervalName: string }) => {
    const { data } = await api.get('/inspections/due', { params });
    return data; // Returns boolean
  },

  submitInspection: async (payload: SubmitInspectionDto): Promise<InspectionTransaction> => {
    const { data } = await api.post('/inspections', payload);
    return data;
  },

  getDashboardData: async () => {
    const { data } = await api.get('/inspections/dashboard');
    return data;
  },

  getRecent: async (filters?: { status?: string | null; approval?: string | null }): Promise<InspectionTransaction[]> => {
    const params: any = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.approval) params.approval = filters.approval;
    const { data } = await api.get('/inspections/recent', { params });
    return data;
  },

  getById: async (id: string): Promise<InspectionTransaction> => {
    const { data } = await api.get(`/inspections/${id}`);
    return data;
  },

  getDailyReport: async (params: { partId: string; operationId: string; mcNo?: string; date?: string }): Promise<InspectionTransaction[]> => {
    const { data } = await api.get('/inspections/daily', { params });
    return data;
  },

  approveInspection: async (id: string): Promise<InspectionTransaction> => {
    const { data } = await api.patch(`/inspections/${id}/approve`);
    return data;
  },

  getDrafts: async () => {
    const { data } = await api.get('/inspections/drafts');
    return data;
  },

  saveDraft: async (payload: any) => {
    const { data } = await api.post('/inspections/drafts', payload);
    return data;
  },

  deleteDraft: async (id: string) => {
    const { data } = await api.delete(`/inspections/drafts/${id}`);
    return data;
  },
};
