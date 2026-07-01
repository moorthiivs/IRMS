import api from '../lib/axios';
import { Part, Operation, InspectionParameter, Shift, UploadHistory, PartWithOperations } from '../types';

export const masterDataService = {
  getParts: async (): Promise<Part[]> => {
    const { data } = await api.get('/master-data/parts');
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

