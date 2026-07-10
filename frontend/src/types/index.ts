export interface User {
  id: string;
  username: string;
  name: string;
  role: 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR' | 'OPERATOR';
  customerId?: string | null;
  customer?: Customer | null;
  signature?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

export interface Customer {
  id: string;
  name: string;
  code: string | null;
  machines?: string[];
  activeMachines?: string[];
  createdAt?: string;
  updatedAt?: string;
  _count?: { parts: number };
}

export interface Part {
  id: string;
  partNumber: string;
  partName: string;
  customerId?: string | null;
  customer?: Customer | null;
}

export interface Operation {
  id: string;
  operationNumber: string;
  operationName: string;
}

export interface OperationWithCount extends Operation {
  parameterCount: number;
}

export interface PartWithOperations {
  id: string;
  partNumber: string;
  partName: string;
  customerId?: string | null;
  customerName?: string | null;
  operations: OperationWithCount[];
}

export interface InspectionParameter {
  id: string;
  partId: string;
  operationId: string;
  parameterName: string;
  nominalValue: string | null;
  lowerTolerance: string | null;
  upperTolerance: string | null;
  specText: string | null;
  controlLimitMin: number | null;
  controlLimitMax: number | null;
  methodOfChecking: string | null;
  freqOfInspn: string | null;
  frequencyUnit: string;
  leastCount: number | null;
  class: string | null;
  sequence: number;
}

export interface InspectionTransaction {
  id: string;
  inspectorId: string;
  shiftId: string;
  partId: string;
  operationId: string;
  lotNumber: string | null;
  mcNo: string | null;
  intervalName: string;
  inspectionTimestamp: string;
  status: 'PASSED' | 'REJECTED';
  remarks: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  inspector?: User;
  approvedBy?: User | null;
  shift?: Shift;
  part?: Part;
  operation?: Operation;
  details?: InspectionDetail[];
  corrections?: CorrectionEntry[];
}

export interface InspectionDetail {
  id: string;
  transactionId: string;
  parameterId: string;
  observedValue: string;
  status: 'PASS' | 'FAIL';
  parameter?: InspectionParameter;
}

export interface CorrectionEntry {
  id: string;
  transactionId: string;
  detailId: string;
  previousValue: string;
  correctedValue: string;
  previousStatus: 'PASS' | 'FAIL';
  correctedStatus: 'PASS' | 'FAIL';
  correctedById: string;
  correctedAt: string;
  remarks: string | null;
  correctedBy?: { name: string; username: string };
  detail?: InspectionDetail;
}

export interface UploadHistory {
  id: string;
  filename: string;
  uploadedById: string;
  uploadTimestamp: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  totalRecords: number;
  importedRecords: number;
  errorLog: string | null;
  uploadedBy?: User;
}

export interface AuthResponse {
  access_token: string;
}

