import api from '../lib/axios';
import { Part, Operation, InspectionParameter, Shift, UploadHistory, PartWithOperations, Customer } from '../types';

export const masterDataService = {
  // ── Customer Methods ─────────────────────────────────────────

  getCustomers: async (): Promise<Customer[]> => {
    const { data } = await api.get('/master-data/customers');
    return data;
  },

  createCustomer: async (name: string, code?: string, machines?: string[]): Promise<Customer> => {
    const { data } = await api.post('/master-data/customers', { name, code, machines });
    return data;
  },

  updateCustomer: async (id: string, name: string, code?: string, machines?: string[]): Promise<Customer> => {
    const { data } = await api.put(`/master-data/customers/${id}`, { name, code, machines });
    return data;
  },

  deleteCustomer: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/master-data/customers/${id}`);
    return data;
  },

  updateCustomerActiveMachines: async (id: string, activeMachines: string[]): Promise<Customer> => {
    const { data } = await api.put(`/master-data/customers/${id}/active-machines`, { activeMachines });
    return data;
  },

  assignPartCustomer: async (partId: string, customerId: string | null): Promise<Part> => {
    const { data } = await api.patch(`/master-data/parts/${partId}/customer`, { customerId });
    return data;
  },

  // ── Part Methods ─────────────────────────────────────────────

  getParts: async (): Promise<Part[]> => {
    const { data } = await api.get('/master-data/parts');
    return data;
  },

  updatePart: async (id: string, partData: { partNumber: string; partName: string; customerId?: string | null }): Promise<Part> => {
    const { data } = await api.put(`/master-data/parts/${id}`, partData);
    return data;
  },

  getPartsWithOperations: async (): Promise<PartWithOperations[]> => {
    const { data } = await api.get('/master-data/parts-with-operations');
    return data;
  },

  downloadTemplate: async (): Promise<Blob> => {
    const { data } = await api.get('/master-data/template', { responseType: 'blob' });
    return data;
  },

  getOperationsByPart: async (partId: string): Promise<Operation[]> => {
    const { data } = await api.get(`/master-data/parts/${partId}/operations`);
    return data;
  },

  updateOperation: async (id: string, operationData: { operationNumber: string; operationName: string }): Promise<Operation> => {
    const { data } = await api.put(`/master-data/operations/${id}`, operationData);
    return data;
  },

  getParameters: async (partId: string, operationId: string): Promise<InspectionParameter[]> => {
    const { data } = await api.get(`/master-data/parameters`, {
      params: { partId, operationId }
    });
    return data;
  },

  getShifts: async (): Promise<Shift[]> => {
    const { data } = await api.get('/master-data/shifts');
    return data;
  },

  deletePart: async (partId: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/master-data/parts/${partId}`);
    return data;
  },

  deletePartOperation: async (partId: string, operationId: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/master-data/parts/${partId}/operations/${operationId}`);
    return data;
  },

  deleteParameter: async (id: string): Promise<{ message: string }> => {
    const { data } = await api.delete(`/master-data/parameters/${id}`);
    return data;
  },

  updateParameters: async (parameters: Partial<InspectionParameter>[]): Promise<InspectionParameter[]> => {
    const { data } = await api.put('/master-data/parameters', { parameters });
    return data;
  },

  // ── Poka Yoke Item Methods ──────────────────────────────────────────

  bulkUpdatePokaYokeItems: async (partId: string, items: any[]): Promise<any> => {
    const { data } = await api.put('/pokayoke/items/bulk', { partId, items });
    return data;
  },

  updatePokaYokeItem: async (id: string, itemData: { pokaYokeName?: string; checkingMethod?: string; frequency?: string; readingType?: string }): Promise<any> => {
    const { data } = await api.put(`/pokayoke/items/${id}`, itemData);
    return data;
  },

  deletePokaYokeItem: async (id: string): Promise<any> => {
    const { data } = await api.delete(`/pokayoke/items/${id}`);
    return data;
  },

  previewUpload: async (file: File): Promise<any> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/master-data/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  uploadData: async (file: File): Promise<{message: string, history: UploadHistory}> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/master-data/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return data;
  },

  getUploadHistory: async (): Promise<UploadHistory[]> => {
    const { data } = await api.get('/master-data/upload/history');
    return data;
  },

};
