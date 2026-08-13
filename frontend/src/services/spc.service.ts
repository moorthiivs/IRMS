import api from '../lib/axios';

export interface SubmitSpcDto {
  shiftId: string;
  partId: string;
  operationId: string;
  lotNumber?: string;
  mcNo: string;
  intervalName: string;
  remarks: string | null;
  details: {
    parameterId: string;
    observedValue: string;
  }[];
}

export const spcService = {
  getDashboardData: async (params?: { customerId?: string; partNumber?: string; machineNumber?: string }) => {
    const { data } = await api.get('/spc/dashboard', { params });
    return data;
  },

  uploadCharacteristics: async (records: any[]) => {
    const { data } = await api.post('/spc/characteristics/upload', { records });
    return data;
  },

  getCharacteristics: async (params?: { partNumber?: string; machineNumber?: string }) => {
    const { data } = await api.get('/spc/characteristics', { params });
    return data;
  },

  updateCharacteristic: async (id: string, payload: any) => {
    const { data } = await api.put(`/spc/characteristics/${id}`, payload);
    return data;
  },

  deleteCharacteristic: async (id: string) => {
    const { data } = await api.delete(`/spc/characteristics/${id}`);
    return data;
  },

  checkDue: async (params: { partId: string; operationId: string; shiftId: string; intervalName: string }) => {
    const { data } = await api.get('/spc/due', { params });
    return data;
  },

  submitSpc: async (payload: SubmitSpcDto) => {
    const { data } = await api.post('/spc/entry', payload);
    return data;
  },

  getRecent: async (filters?: { status?: string | null; shiftId?: string | null; partId?: string | null; partNumber?: string | null; operationId?: string | null; customerId?: string | null; machineNumber?: string | null; date?: string | null }) => {
    const params: any = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.shiftId) params.shiftId = filters.shiftId;
    if (filters?.partId) params.partId = filters.partId;
    if (filters?.partNumber) params.partNumber = filters.partNumber;
    if (filters?.operationId) params.operationId = filters.operationId;
    if (filters?.customerId) params.customerId = filters.customerId;
    if (filters?.machineNumber) params.machineNumber = filters.machineNumber;
    if (filters?.date) params.date = filters.date;
    const { data } = await api.get('/spc/recent', { params });
    return data;
  },

  checkDuplicate: async (params: { date: string; partNumber: string; machineNumber?: string }) => {
    const { data } = await api.get('/spc/check-duplicate', { params });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await api.get(`/spc/reports/${id}`);
    return data;
  },

  getDrafts: async () => {
    const { data } = await api.get('/spc/drafts');
    return data;
  },

  saveDraft: async (payload: any) => {
    const { data } = await api.post('/spc/drafts', payload);
    return data;
  },

  deleteDraft: async (id: string) => {
    const { data } = await api.delete(`/spc/drafts/${id}`);
    return data;
  },

  deleteSpc: async (id: string) => {
    const { data } = await api.delete(`/spc/${id}`);
    return data;
  },

  uploadSpcDataByPartNo: async (records: any[]) => {
    const { data } = await api.post('/spc/upload-partno', { records });
    return data;
  },

  getSpcDataByPartNumber: async (partNumber: string) => {
    const { data } = await api.get(`/spc/part-data/${encodeURIComponent(partNumber)}`);
    return data;
  },
};
