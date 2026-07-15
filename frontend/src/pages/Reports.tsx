import React, { useState, useMemo } from 'react';
import { 
  Paper, Table, Group, Badge, ActionIcon, 
  Tabs, Select, TextInput, Button, Text, Tooltip,
  Modal, Checkbox, SimpleGrid, Textarea, Timeline, ThemeIcon, Autocomplete, LoadingOverlay, Box, Avatar
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Printer, FileText, Search, LayoutGrid, CheckCircle, FileCheck, Wrench, History, ArrowRight, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import { useAuthStore } from '../store/auth-store';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { TableSkeleton } from '../components/TableSkeleton';
import { CorrectionEntry } from '../types';

export function Reports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const canApprove = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const [activeTab, setActiveTab] = useState<string | null>('history');
  const [searchParams, setSearchParams] = useSearchParams();
  const filterStatus = searchParams.get('status');
  const filterApproval = searchParams.get('approval');

  // History Tab filter states
  const [historyCustomer, setHistoryCustomer] = useState<string | null>(null);
  const [historyDate, setHistoryDate] = useState<Date | null>(() => {
    const d = searchParams.get('date');
    if (d === 'today') return new Date();
    if (d) return new Date(d);
    return new Date();
  });
  const [historyShift, setHistoryShift] = useState<string | null>(null);
  const [historyPart, setHistoryPart] = useState<string | null>(null);
  const [historyOp, setHistoryOp] = useState<string | null>(null);
  const [historyHasMc, setHistoryHasMc] = useState<boolean>(searchParams.get('hasMc') === 'true');

  // Report filter states
  const [reportCustomer, setReportCustomer] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [selectedMcNo, setSelectedMcNo] = useState<string>('');

  // Approval Modal State
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [reviewedChecked, setReviewedChecked] = useState(false);

  // Feature 5: Correction (Take Action) Modal State
  const [correctionTx, setCorrectionTx] = useState<any | null>(null);
  const [correctionValues, setCorrectionValues] = useState<Record<string, string>>({});
  const [correctionRemarks, setCorrectionRemarks] = useState('');

  // Feature 5: Audit Trail Drawer State
  const [auditTrailId, setAuditTrailId] = useState<string | null>(null);
  const [auditTrailData, setAuditTrailData] = useState<CorrectionEntry[]>([]);

  // Bulk Operations State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkApprovePending, setBulkApprovePending] = useState(false);

  // 1. Transaction History Query
  const { data: recent = [], isLoading: isRecentLoading } = useQuery({
    queryKey: ['recent-inspections', filterStatus, filterApproval, historyDate, historyShift, historyPart, historyOp],
    queryFn: () => {
      const formattedDate = historyDate ? 
        `${historyDate.getFullYear()}-${String(historyDate.getMonth() + 1).padStart(2, '0')}-${String(historyDate.getDate()).padStart(2, '0')}` 
        : undefined;
      return inspectionService.getRecent({ 
        status: filterStatus, 
        approval: filterApproval,
        date: formattedDate,
        shiftId: historyShift || undefined,
        partId: historyPart || undefined,
        operationId: historyOp || undefined,
        hasMc: historyHasMc ? 'true' : undefined
      });
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: masterDataService.getShifts
  });

  // 2. Dropdown queries for daily audit report
  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers
  });

  const filteredHistoryParts = historyCustomer ? parts.filter((p: any) => p.customerId === historyCustomer) : parts;
  
  // Fetch available options for the selected date and customer
  const { data: dailyOptions } = useQuery({
    queryKey: ['daily-options', selectedDate, reportCustomer, selectedPart, selectedOp],
    queryFn: () => {
      const formattedDate = selectedDate ? 
        `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` 
        : undefined;
      return inspectionService.getDailyOptions({
        date: formattedDate,
        customerId: reportCustomer || undefined,
        partId: selectedPart || undefined,
        operationId: selectedOp || undefined
      });
    },
    enabled: !!selectedDate // Only fetch if we have a date selected
  });

  const filteredReportParts = (reportCustomer ? parts.filter((p: any) => p.customerId === reportCustomer) : parts)
    .filter((p: any) => dailyOptions?.partIds ? dailyOptions.partIds.includes(p.id) : false);

  const reportCustomerData = customers.find((c: any) => c.id === reportCustomer);
  
  // Use dailyOptions mcNos if available and filtering, otherwise fallback to customer machines
  const reportCustomerMachines = dailyOptions?.mcNos ? dailyOptions.mcNos : (reportCustomerData?.machines || []);

  const { data: operations = [] } = useQuery({
    queryKey: ['operations', selectedPart],
    queryFn: () => masterDataService.getOperationsByPart(selectedPart!),
    enabled: !!selectedPart,
    select: (data) => data.filter(o => !dailyOptions?.operationIds || dailyOptions.operationIds.includes(o.id))
  });

  const { data: historyOperations = [] } = useQuery({
    queryKey: ['operations', historyPart],
    queryFn: () => masterDataService.getOperationsByPart(historyPart!),
    enabled: !!historyPart
  });

  // 3. Daily report transactions query
  const { data: dailyReportTransactions = [], refetch: refetchDailyReport, isFetching: isDailyFetching } = useQuery({
    queryKey: ['daily-report', selectedPart, selectedOp, selectedMcNo, selectedDate],
    queryFn: () => {
      const formattedDate = selectedDate ? 
        `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}` 
        : undefined;
      return inspectionService.getDailyReport({
        partId: selectedPart!,
        operationId: selectedOp!,
        mcNo: selectedMcNo || undefined,
        date: formattedDate
      });
    },
    enabled: false // Trigger manually on "Generate Report"
  });

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', selectedPart, selectedOp],
    queryFn: () => masterDataService.getParameters(selectedPart!, selectedOp!),
    enabled: !!selectedPart && !!selectedOp
  });

  const handleGenerateReport = () => {
    if (!selectedPart || !selectedOp) return;
    refetchDailyReport();
  };

  const handlePrint = () => {
    window.print();
  };

  const deleteMutation = useMutation({
    mutationFn: inspectionService.deleteInspection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      notifications.show({ title: 'Deleted', message: 'Inspection report deleted successfully.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to delete report.', color: 'red' });
    },
  });

  const handleDelete = (id: string) => {
    modals.openConfirmModal({
      title: 'Delete Inspection Report',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete this inspection report? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete Report', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: inspectionService.approveInspection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
      refetchDailyReport();
      setApprovalId(null);
      setReviewedChecked(false);
      notifications.show({ title: 'Approved', message: 'Inspection approved successfully.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to approve.', color: 'red' });
    },
  });

  // Feature 5: Correction mutation
  const correctionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      inspectionService.correctInspection(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      setCorrectionTx(null);
      setCorrectionValues({});
      setCorrectionRemarks('');
      notifications.show({ title: 'Correction Saved', message: 'Failed parameters have been corrected. Status has been re-evaluated.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to save corrections.', color: 'red' });
    },
  });

  // Feature 5: Open Take Action modal
  const handleTakeAction = async (txId: string) => {
    try {
      const tx = await inspectionService.getById(txId);
      setCorrectionTx(tx);
      // Pre-fill correction values with current failed values
      const initialValues: Record<string, string> = {};
      tx.details?.filter(d => d.status === 'FAIL').forEach(d => {
        initialValues[d.id] = d.observedValue;
      });
      setCorrectionValues(initialValues);
      setCorrectionRemarks('');
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load inspection details.', color: 'red' });
    }
  };

  // Feature 5: Submit corrections
  const handleSubmitCorrections = () => {
    if (!correctionTx) return;
    const corrections = Object.entries(correctionValues)
      .filter(([detailId, value]) => {
        const original = correctionTx.details?.find((d: any) => d.id === detailId);
        return original && value !== original.observedValue; // Only send changed values
      })
      .map(([detailId, correctedValue]) => ({ detailId, correctedValue }));

    if (corrections.length === 0) {
      notifications.show({ title: 'No Changes', message: 'Please modify at least one value to submit a correction.', color: 'orange' });
      return;
    }

    correctionMutation.mutate({
      id: correctionTx.id,
      payload: { corrections, remarks: correctionRemarks || undefined },
    });
  };

  const handleBulkDelete = () => {
    modals.openConfirmModal({
      title: 'Bulk Delete Inspections',
      centered: true,
      children: <Text size="sm">Are you sure you want to delete {selectedIds.length} inspection(s)?</Text>,
      labels: { confirm: 'Delete All', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        setBulkDeletePending(true);
        try {
          await Promise.all(selectedIds.map(id => inspectionService.deleteInspection(id)));
          notifications.show({ title: 'Deleted', message: `${selectedIds.length} report(s) deleted.`, color: 'green' });
          setSelectedIds([]);
          queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
          queryClient.invalidateQueries({ queryKey: ['daily-report'] });
        } catch (error) {
          notifications.show({ title: 'Error', message: 'Failed to delete some reports.', color: 'red' });
        } finally {
          setBulkDeletePending(false);
        }
      }
    });
  };

  const handleBulkApprove = (groupTxs: any[]) => {
    const unapproved = groupTxs.filter(tx => tx.status === 'PASSED' && !tx.approvedById);
    if (unapproved.length === 0) return;

    modals.openConfirmModal({
      title: 'Bulk Approve Group',
      centered: true,
      children: <Text size="sm">Are you sure you want to approve {unapproved.length} pending inspection(s) for this group?</Text>,
      labels: { confirm: 'Approve All', cancel: 'Cancel' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        setBulkApprovePending(true);
        try {
          await Promise.all(unapproved.map(tx => inspectionService.approveInspection(tx.id)));
          notifications.show({ title: 'Approved', message: `${unapproved.length} report(s) approved.`, color: 'green' });
          queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
          queryClient.invalidateQueries({ queryKey: ['daily-report'] });
        } catch (error) {
          notifications.show({ title: 'Error', message: 'Failed to approve some reports.', color: 'red' });
        } finally {
          setBulkApprovePending(false);
        }
      }
    });
  };

  const isGlobalPending = deleteMutation.isPending || approveMutation.isPending || correctionMutation.isPending || bulkDeletePending || bulkApprovePending;

  // Feature 5: Open Audit Trail
  const handleViewAuditTrail = async (txId: string) => {
    try {
      const trail = await inspectionService.getAuditTrail(txId);
      setAuditTrailData(trail);
      setAuditTrailId(txId);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load audit trail.', color: 'red' });
    }
  };

  // Get inspector signature for a shift/interval
  const getInspectorSignature = (shiftName: string, intervalName: string) => {
    const tx = getTxMetadata(shiftName, intervalName);
    if (!tx?.inspector?.signature) return null;
    return (
      <img src={tx.inspector.signature} alt="Sig" style={{ height: 36, maxWidth: '100%', objectFit: 'contain', display: 'inline-block', mixBlendMode: 'multiply', verticalAlign: 'middle' }} />
    );
  };

  // Get approver signature for a shift (any approved tx for this shift)
  const getApproverSignature = (shiftName: string) => {
    const shiftTxs = dailyReportTransactions.filter(
      t => t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && t.approvedBy?.signature
    );
    if (shiftTxs.length === 0) return <Text size="xs" c="dimmed" fs="italic">Pending</Text>;
    const approver = shiftTxs[0].approvedBy;
    return (
      <div style={{ textAlign: 'center' }}>
        <img src={approver!.signature!} alt="Sig" style={{ height: 36, maxWidth: '100%', objectFit: 'contain', display: 'inline-block', mixBlendMode: 'multiply', verticalAlign: 'middle' }} />
      </div>
    );
  };

  // Check if shift has unapproved transactions (for approve button)
  const getUnapprovedTxIds = (shiftName: string): string[] => {
    return dailyReportTransactions
      .filter(t => t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && !t.approvedById)
      .map(t => t.id);
  };

  // Helper to determine reading count requirements
  const getReadingCount = (freq: string | null | undefined): number => {
    if (!freq) return 1;
    const lowerFreq = freq.toLowerCase().trim();
    if (lowerFreq.includes('4nos') || lowerFreq.startsWith('4')) {
      return 2;
    }
    return 1;
  };

  // Helper to retrieve inspection details for Shift and Interval
  const getCellContent = (shiftName: string, intervalName: string, param: typeof parameters[0]) => {
    const tx = dailyReportTransactions.find(t => 
      t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && 
      t.intervalName === intervalName
    );
    
    if (!tx || !tx.details) {
      // Draw empty diagonal divider if parameter needs 2 readings per half-shift (4/shift total)
      if (getReadingCount(param.freqOfInspn) === 2) {
        return (
          <div className="relative h-12 w-full">
            <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="100" x2="100" y2="0" stroke="#000" strokeWidth="1" />
            </svg>
          </div>
        );
      }
      return null;
    }

    const readings = tx.details.filter(d => d.parameterId === param.id);
    if (readings.length === 0) {
      if (getReadingCount(param.freqOfInspn) === 2) {
        return (
          <div className="relative h-12 w-full">
            <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="100" x2="100" y2="0" stroke="#000" strokeWidth="1" />
            </svg>
          </div>
        );
      }
      return null;
    }

    if (readings.length >= 2) {
      return (
        <div className="relative h-12 w-full">
          <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            <line x1="0" y1="100" x2="100" y2="0" stroke="#000000" strokeWidth="1.2" />
          </svg>
          <span className={`absolute top-1 left-1.5 text-[10px] leading-none ${readings[0].status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
            {readings[0].observedValue}
          </span>
          <span className={`absolute bottom-1 right-1.5 text-[10px] leading-none ${readings[1].status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
            {readings[1].observedValue}
          </span>
        </div>
      );
    }

    const singleReading = readings[0];
    return (
      <div className={`flex items-center justify-center h-12 w-full text-center text-xs font-semibold ${singleReading.status === 'FAIL' ? 'text-red-600' : 'text-gray-800'}`}>
        {singleReading.observedValue}
      </div>
    );
  };

  const isOncePerDay = (param: any) => {
    return param.frequencyUnit === 'Day-wise' || param.frequencyUnit === 'day';
  };

  const isOncePerShift = (param: any) => {
    if (isOncePerDay(param)) return false;
    const freq = String(param.freqOfInspn || '').toLowerCase().trim();
    return freq === '1' || freq === 'once per shift' || freq === '1no/shift' || freq === '1/shift' || freq === '1/day';
  };

  const getMergedCellContentDay = (param: any) => {
    const allTransactions = [...dailyReportTransactions]
      .sort((a, b) => new Date(a.inspectionTimestamp).getTime() - new Date(b.inspectionTimestamp).getTime());
    
    const freqNum = parseInt(param.freqOfInspn || '1', 10);

    // Diagonal line for Freq: 2 Day-wise
    if (freqNum === 2) {
      const readings: any[] = [];
      allTransactions.forEach(tx => {
        if (tx.details) {
          tx.details.forEach((d: any) => {
            if (d.parameterId === param.id) readings.push(d);
          });
        }
      });
      return (
        <Table.Td p={0} colSpan={6}>
          <div className="relative h-12 w-full flex items-center justify-center">
            <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="100" x2="100" y2="0" stroke="#000000" strokeWidth="1" />
            </svg>
            <span className={`absolute top-2 left-[30%] text-xs leading-none ${readings[0]?.status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
              {readings[0]?.observedValue || ''}
            </span>
            <span className={`absolute bottom-2 right-[30%] text-xs leading-none ${readings[1]?.status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
              {readings[1]?.observedValue || ''}
            </span>
          </div>
        </Table.Td>
      );
    }

    // Centered 3 columns matching Shift A, B, C for Freq: 3 Day-wise
    if (freqNum === 3) {
      const shiftReadings = [null, null, null] as any[];
      allTransactions.forEach(tx => {
        if (tx.details) {
          tx.details.forEach((d: any) => {
            if (d.parameterId === param.id) {
              const shiftIdx = shifts.findIndex((s: any) => s.id === tx.shiftId);
              if (shiftIdx >= 0 && shiftIdx < 3 && !shiftReadings[shiftIdx]) {
                shiftReadings[shiftIdx] = d;
              }
            }
          });
        }
      });

      return (
        <>
          {shiftReadings.map((reading, idx) => (
            <Table.Td key={idx} p={0} colSpan={2} className="text-center h-12 align-middle">
              {reading && (
                <span className={`text-xs ${reading.status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
                  {reading.observedValue || ''}
                </span>
              )}
            </Table.Td>
          ))}
        </>
      );
    }

    // Default centered single block for everything else (Freq: 1)
    const readings: any[] = [];
    allTransactions.forEach(tx => {
      if (tx.details) {
        tx.details.forEach((d: any) => {
          if (d.parameterId === param.id) readings.push(d);
        });
      }
    });

    return (
      <Table.Td p={0} colSpan={6} className="text-center h-12 align-middle">
        {readings[readings.length - 1] && (
          <span className={`text-xs ${readings[readings.length - 1].status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
            {readings[readings.length - 1].observedValue || ''}
          </span>
        )}
      </Table.Td>
    );
  };

  const getMergedCellContent = (shiftName: string, param: any) => {
    // Get transactions for this shift, sorted by timestamp ascending so latest is last
    const shiftTransactions = dailyReportTransactions
      .filter(t => t.shift?.name?.toLowerCase() === shiftName.toLowerCase())
      .sort((a, b) => new Date(a.inspectionTimestamp).getTime() - new Date(b.inspectionTimestamp).getTime());
    
    if (shiftTransactions.length === 0) return null;
    
    const readings: any[] = [];
    shiftTransactions.forEach(tx => {
      if (tx.details) {
        tx.details.forEach(d => {
          if (d.parameterId === param.id) {
            readings.push(d);
          }
        });
      }
    });

    if (readings.length === 0) return null;

    // Show only the latest item
    const r = readings[readings.length - 1];
    return (
      <div className={`flex items-center justify-center h-12 w-full text-center text-xs font-semibold ${r.status === 'FAIL' ? 'text-red-600' : 'text-gray-800'}`}>
        {r.observedValue}
      </div>
    );
  };

  // Helper to fetch transaction metadata for a shift and half
  const getTxMetadata = (shiftName: string, intervalName: string) => {
    return dailyReportTransactions.find(t => 
      t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && 
      t.intervalName === intervalName
    );
  };

  const getFooterStatus = (shiftName: string, intervalName: string) => {
    const tx = getTxMetadata(shiftName, intervalName);
    if (!tx) return '-';
    return (
      <Badge color={tx.status === 'PASSED' ? 'green' : 'red'} variant="filled" size="xs">
        {tx.status === 'PASSED' ? 'OK' : 'NG'}
      </Badge>
    );
  };

  const getFooterInspector = (shiftName: string, intervalName: string) => {
    const tx = getTxMetadata(shiftName, intervalName);
    return tx?.inspector?.name || '-';
  };

  const getRemarksText = () => {
    const activeRemarks = dailyReportTransactions
      .filter(t => t.remarks)
      .map(t => `${t.shift?.name || 'Shift'}: ${t.remarks}`);
    return activeRemarks.length > 0 ? activeRemarks.join(' | ') : 'No remarks logged today.';
  };

  // Find Part details
  const currentPartInfo = parts.find(p => p.id === selectedPart);

  // Feature 2: Group Recent Inspections (Sleek UI)
  const groupedRecent = useMemo(() => {
    const groups: Record<string, any> = {};
    recent.forEach((tx: any) => {
      const custName = (tx.part?.customer?.name || 'Unknown Customer').toUpperCase();
      const partNo = tx.part?.partNumber || 'Unknown Part';
      const opNo = tx.operation?.operationNumber || 'Unknown Op';
      const mcNo = tx.mcNo || 'Unknown M/C';
      const dateStr = new Date(tx.inspectionTimestamp).toLocaleDateString();

      const l1 = `${dateStr} | ${custName} - ${partNo}`;
      const l2 = `OP: ${opNo}`;
      const l3 = `M/C: ${mcNo}`;

      if (!groups[l1]) groups[l1] = { txs: [], children: {} };
      groups[l1].txs.push(tx);

      if (!groups[l1].children[l2]) groups[l1].children[l2] = { txs: [], children: {} };
      groups[l1].children[l2].txs.push(tx);

      if (!groups[l1].children[l2].children[l3]) groups[l1].children[l2].children[l3] = { txs: [] };
      groups[l1].children[l2].children[l3].txs.push(tx);
    });
    return groups;
  }, [recent]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAll = (checked: boolean, txIds: string[]) => {
    if (checked) {
      setSelectedIds(prev => [...new Set([...prev, ...txIds])]);
    } else {
      setSelectedIds(prev => prev.filter(id => !txIds.includes(id)));
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <LoadingOverlay visible={isGlobalPending} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.1in;
          }
          :root {
            --app-shell-navbar-offset: 0px !important;
            --app-shell-header-offset: 0px !important;
          }
          /* Hide AppShell layout headers, navbars, sidebars, and print elements */
          header,
          aside,
          nav,
          [data-header],
          [data-navbar],
          .mantine-AppShell-header,
          .mantine-AppShell-navbar,
          .print\\:hidden {
            display: none !important;
          }
          html,
          body,
          #root,
          .mantine-AppShell-root,
          .mantine-AppShell-main,
          main {
            padding: 0 !important;
            margin: 0 !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            min-height: 0 !important;
            --app-shell-navbar-offset: 0px !important;
            --app-shell-header-offset: 0px !important;
          }
          /* Remove layout container limits for printing */
          .max-w-7xl {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body {
            background: white !important;
            color: black !important;
            width: 100% !important;
            height: auto !important;
          }
          .print\:border-0 {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Ensure color and background graphics render in PDF */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Darker, clean borders for printing */
          table, th, td, .border, [class*="border"] {
            border-color: #000000 !important;
          }
        }
      `}</style>



      <Tabs variant="pills" value={activeTab} onChange={setActiveTab} className="print:hidden">
        <Tabs.List mb="xl">
          <Tabs.Tab value="history" leftSection={<FileText size={14} />}>
            Individual Submissions
          </Tabs.Tab>
          <Tabs.Tab value="daily" leftSection={<LayoutGrid size={14} />}>
            Daily Audit Check Sheet
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="history">
          <Group justify="space-between" align="center" mb="lg">
            <Group gap="sm" wrap="wrap">
              <Text size="sm" fw={600} c="dimmed">All Status ({recent.length})</Text>
              
              <DatePickerInput
                placeholder="Date"
                size="xs"
                value={historyDate}
                onChange={setHistoryDate}
                clearable
                w={130}
                styles={{ input: { border: 'none', backgroundColor: '#f1f3f5' } }}
              />
              <Select
                placeholder="Shift"
                size="xs"
                data={shifts.map((s: any) => ({ value: s.id, label: s.name }))}
                value={historyShift}
                onChange={setHistoryShift}
                clearable
                searchable
                w={120}
                styles={{ input: { border: 'none', backgroundColor: '#f1f3f5' } }}
              />
              <Select
                placeholder="Customer"
                size="xs"
                data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
                value={historyCustomer}
                onChange={(v) => { setHistoryCustomer(v); setHistoryPart(null); setHistoryOp(null); }}
                clearable
                searchable
                w={150}
                styles={{ input: { border: 'none', backgroundColor: '#f1f3f5' } }}
              />
              <Select
                placeholder="Part"
                size="xs"
                data={filteredHistoryParts.map((p: any) => ({ value: p.id, label: p.partNumber }))}
                value={historyPart}
                onChange={(v) => { setHistoryPart(v); setHistoryOp(null); }}
                clearable
                searchable
                w={150}
                styles={{ input: { border: 'none', backgroundColor: '#f1f3f5' } }}
              />
              <Select
                placeholder="Operation"
                size="xs"
                data={historyOperations.map(o => ({ value: o.id, label: o.operationNumber }))}
                value={historyOp}
                onChange={setHistoryOp}
                clearable
                searchable
                disabled={!historyPart}
                w={120}
                styles={{ input: { border: 'none', backgroundColor: '#f1f3f5' } }}
              />
              {(historyDate || historyShift || historyCustomer || historyPart || historyOp) && (
                <Button size="xs" variant="subtle" color="gray" onClick={() => {
                  setSearchParams({});
                  setHistoryDate(null);
                  setHistoryShift(null);
                  setHistoryPart(null);
                  setHistoryOp(null);
                  setHistoryHasMc(false);
                }}>
                  Clear
                </Button>
              )}
            </Group>

            <Group gap="sm">
              {filterStatus && (
                <Badge color={filterStatus === 'PASSED' ? 'green' : 'red'} variant="light">
                  {filterStatus}
                </Badge>
              )}
              {filterApproval === 'pending' && (
                <Badge color="violet" variant="light">
                  Approval Pending
                </Badge>
              )}
              {selectedIds.length > 0 && (
                <Button size="xs" color="red" variant="light" onClick={handleBulkDelete} loading={bulkDeletePending}>
                  Delete ({selectedIds.length})
                </Button>
              )}
              {canApprove && selectedIds.length > 0 && recent.filter((t: any) => selectedIds.includes(t.id) && t.status === 'PASSED' && !t.approvedById).length > 0 && (
                <Button size="xs" color="green" variant="light" onClick={() => handleBulkApprove(recent.filter((t: any) => selectedIds.includes(t.id)))}>
                  Approve ({recent.filter((t: any) => selectedIds.includes(t.id) && t.status === 'PASSED' && !t.approvedById).length})
                </Button>
              )}
            </Group>
          </Group>

          <Box className="w-full">
            {isRecentLoading ? (
              <TableSkeleton rows={8} />
            ) : (
              <div className="overflow-x-auto">
                <Table verticalSpacing="md" striped={false} withRowBorders className="min-w-[900px] border border-gray-200 rounded-md overflow-hidden">
                  <Table.Thead className="bg-gray-50">
                    <Table.Tr>
                      <Table.Th style={{ width: 40, borderBottom: 'none' }}>
                        <Checkbox
                          checked={recent.length > 0 && selectedIds.length === recent.length}
                          indeterminate={selectedIds.length > 0 && selectedIds.length < recent.length}
                          onChange={(e) => handleSelectAll(e.currentTarget.checked, recent.map((t: any) => t.id))}
                          color="indigo"
                        />
                      </Table.Th>
                      <Table.Th style={{ borderBottom: 'none' }}><Text size="xs" fw={600} c="dimmed">Report / Details</Text></Table.Th>
                      <Table.Th style={{ borderBottom: 'none' }}><Text size="xs" fw={600} c="dimmed">Shift & Lot</Text></Table.Th>
                      <Table.Th style={{ borderBottom: 'none' }}><Text size="xs" fw={600} c="dimmed">Inspector</Text></Table.Th>
                      <Table.Th style={{ borderBottom: 'none' }}><Text size="xs" fw={600} c="dimmed">Accuracy / Status</Text></Table.Th>
                      <Table.Th style={{ borderBottom: 'none', width: 140 }}><Text size="xs" fw={600} c="dimmed">Assigned On</Text></Table.Th>
                      <Table.Th style={{ borderBottom: 'none' }}><Text size="xs" fw={600} c="dimmed">Actions</Text></Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                    <Table.Tbody>
                      {Object.entries(groupedRecent).map(([l1Key, l1Node]: [string, any]) => (
                        <React.Fragment key={l1Key}>
                          {/* LEVEL 1: Customer / Part */}
                          <Table.Tr 
                            className="cursor-pointer bg-white hover:bg-gray-50 transition-colors"
                            onClick={() => toggleGroup(l1Key)}
                          >
                            <Table.Td colSpan={7} className="py-3">
                              <Group justify="space-between">
                                <Group gap="sm">
                                  <ActionIcon variant="subtle" color="gray" size="sm">
                                    {expandedGroups[l1Key] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                  </ActionIcon>
                                  <Checkbox
                                    color="indigo"
                                    checked={l1Node.txs.length > 0 && l1Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                    indeterminate={l1Node.txs.some((t: any) => selectedIds.includes(t.id)) && !l1Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      handleSelectAll(e.currentTarget.checked, l1Node.txs.map((t: any) => t.id));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <Avatar color="indigo" radius="xl" size="sm">{l1Key.charAt(0)}</Avatar>
                                  <Text size="sm" fw={700} className="text-gray-900">{l1Key}</Text>
                                  <Badge size="sm" variant="light" color="gray" radius="xl">{l1Node.txs.length}</Badge>
                                </Group>
                                <Group>
                                  {l1Node.txs.some((tx: any) => tx.status === 'REJECTED') && (
                                    <Badge color="red" variant="dot" size="sm" className="border-none bg-transparent">Action Required</Badge>
                                  )}
                                </Group>
                              </Group>
                            </Table.Td>
                          </Table.Tr>

                          {expandedGroups[l1Key] && Object.entries(l1Node.children).map(([l2Key, l2Node]: [string, any]) => {
                            const l2FullKey = `${l1Key}-${l2Key}`;
                            return (
                              <React.Fragment key={l2FullKey}>
                                {/* LEVEL 2: Operation */}
                                <Table.Tr
                                  className="cursor-pointer bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                  onClick={() => toggleGroup(l2FullKey)}
                                >
                                  <Table.Td colSpan={7} className="py-2.5">
                                    <Group justify="space-between" ml={32}>
                                      <Group gap="sm">
                                        <ActionIcon variant="subtle" color="gray" size="sm">
                                          {expandedGroups[l2FullKey] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </ActionIcon>
                                        <Checkbox
                                          size="sm"
                                          color="indigo"
                                          checked={l2Node.txs.length > 0 && l2Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                          indeterminate={l2Node.txs.some((t: any) => selectedIds.includes(t.id)) && !l2Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            handleSelectAll(e.currentTarget.checked, l2Node.txs.map((t: any) => t.id));
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <Text size="sm" fw={600} className="text-gray-700">{l2Key}</Text>
                                        <Badge size="xs" variant="outline" color="gray" radius="xl">{l2Node.txs.length}</Badge>
                                      </Group>
                                    </Group>
                                  </Table.Td>
                                </Table.Tr>

                                {expandedGroups[l2FullKey] && Object.entries(l2Node.children).map(([l3Key, l3Node]: [string, any]) => {
                                  const l3FullKey = `${l2FullKey}-${l3Key}`;
                                  return (
                                    <React.Fragment key={l3FullKey}>
                                      {/* LEVEL 3: M/C No */}
                                      <Table.Tr
                                        className="cursor-pointer bg-gray-50/80 hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleGroup(l3FullKey)}
                                      >
                                        <Table.Td colSpan={7} className="py-2">
                                          <Group justify="space-between" ml={64}>
                                            <Group gap="sm">
                                              <ActionIcon variant="subtle" color="gray" size="sm">
                                                {expandedGroups[l3FullKey] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                              </ActionIcon>
                                              <Checkbox
                                                size="sm"
                                                color="indigo"
                                                checked={l3Node.txs.length > 0 && l3Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                                indeterminate={l3Node.txs.some((t: any) => selectedIds.includes(t.id)) && !l3Node.txs.every((t: any) => selectedIds.includes(t.id))}
                                                onChange={(e) => {
                                                  e.stopPropagation();
                                                  handleSelectAll(e.currentTarget.checked, l3Node.txs.map((t: any) => t.id));
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                              <Text size="sm" fw={600} className="text-gray-600">{l3Key}</Text>
                                            </Group>
                                            <Group>
                                              {canApprove && l3Node.txs.some((tx: any) => tx.status === 'PASSED' && !tx.approvedById) && (
                                                <Button size="compact-xs" color="green" variant="light" onClick={(e) => { e.stopPropagation(); handleBulkApprove(l3Node.txs); }}>
                                                  Approve All
                                                </Button>
                                              )}
                                            </Group>
                                          </Group>
                                        </Table.Td>
                                      </Table.Tr>

                                      {/* LEVEL 4: Items */}
                                      {expandedGroups[l3FullKey] && l3Node.txs.map((item: any) => (
                                        <Table.Tr
                                          key={item.id}
                                          className={`transition-colors ${
                                            selectedIds.includes(item.id) 
                                              ? 'bg-indigo-50/50' 
                                              : 'hover:bg-gray-50 bg-white'
                                          }`}
                                        >
                                          <Table.Td style={{ width: 40, borderBottom: 'none' }}>
                                            <div className="ml-[96px]">
                                              <Checkbox
                                                checked={selectedIds.includes(item.id)}
                                                onChange={(e) => {
                                                  if (e.currentTarget.checked) {
                                                    setSelectedIds(prev => [...prev, item.id]);
                                                  } else {
                                                    setSelectedIds(prev => prev.filter(id => id !== item.id));
                                                  }
                                                }}
                                                color="indigo"
                                              />
                                            </div>
                                          </Table.Td>
                                          <Table.Td style={{ borderBottom: 'none' }}>
                                            <Group gap="sm">
                                              <div>
                                                <Text size="sm" fw={600} className="text-gray-900">{item.part?.customer?.name} - {item.part?.partNumber}</Text>
                                                <Text size="xs" c="dimmed">{item.operation?.operationNumber} {item.mcNo ? `• M/C: ${item.mcNo}` : ''}</Text>
                                              </div>
                                            </Group>
                                          </Table.Td>
                                          <Table.Td style={{ borderBottom: 'none' }}>
                                            <Text size="sm" fw={500} className="text-gray-700">{item.shift?.name}</Text>
                                            <Text size="xs" c="dimmed">Lot: {item.lotNumber || '-'}</Text>
                                          </Table.Td>
                                          <Table.Td style={{ borderBottom: 'none' }}>
                                            <Group gap="xs">
                                              <Avatar radius="xl" size="sm" color="gray" src={undefined}>
                                                {item.inspector?.name?.charAt(0) || 'U'}
                                              </Avatar>
                                              <Text size="sm" fw={500} className="text-gray-700">{item.inspector?.name}</Text>
                                            </Group>
                                          </Table.Td>
                                          <Table.Td style={{ borderBottom: 'none' }}>
                                            <Group gap="xs">
                                              {item.status === 'PASSED' ? (
                                                <Badge color="green" variant="dot" size="md" className="border-none bg-transparent shadow-none px-0">100% OK</Badge>
                                              ) : (
                                                <Badge color="red" variant="dot" size="md" className="border-none bg-transparent shadow-none px-0">Failed</Badge>
                                              )}
                                            </Group>
                                          </Table.Td>
                                          <Table.Td style={{ borderBottom: 'none' }}>
                                            <Text size="sm" className="text-gray-700">{new Date(item.inspectionTimestamp).toLocaleDateString()}</Text>
                                            <Text size="xs" c="dimmed">{new Date(item.inspectionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                          </Table.Td>
                                          <Table.Td style={{ borderBottom: 'none' }}>
                                            <Group gap="xs" wrap="nowrap">
                                              <ActionIcon variant="subtle" color="gray" onClick={() => navigate(`/reports/${item.id}`)}>
                                                <Eye size={16} />
                                              </ActionIcon>
                                              <ActionIcon variant="subtle" color="gray" onClick={() => navigate(`/reports/${item.id}`)}>
                                                <Printer size={16} />
                                              </ActionIcon>
                                              {item.status === 'REJECTED' && (
                                                <Tooltip label="Take Action">
                                                  <ActionIcon variant="light" color="orange" onClick={() => handleTakeAction(item.id)}>
                                                    <Wrench size={16} />
                                                  </ActionIcon>
                                                </Tooltip>
                                              )}
                                              <Tooltip label="Audit Trail">
                                                <ActionIcon variant="subtle" color="gray" onClick={() => handleViewAuditTrail(item.id)}>
                                                  <History size={16} />
                                                </ActionIcon>
                                              </Tooltip>
                                              {item.status === 'PASSED' && !item.approvedById && canApprove && (
                                                <ActionIcon variant="light" color="violet" onClick={() => { setApprovalId(item.id); setReviewedChecked(false); }}>
                                                  <FileCheck size={16} />
                                                </ActionIcon>
                                              )}
                                              {isAdmin && (
                                                <Tooltip label="Delete">
                                                  <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 size={16} />
                                                  </ActionIcon>
                                                </Tooltip>
                                              )}
                                            </Group>
                                          </Table.Td>
                                        </Table.Tr>
                                      ))}
                                    </React.Fragment>
                                  )
                                })}
                              </React.Fragment>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </Table.Tbody>
                </Table>
              </div>
            )}
          </Box>
        </Tabs.Panel>

        <Tabs.Panel value="daily">
          <Paper withBorder p="md" radius="md" mb="lg">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 6 }} spacing="md">
              <DatePickerInput
                label="Select Date"
                placeholder="Select date"
                value={selectedDate}
                onChange={setSelectedDate}
                clearable
              />
              <Select
                label="Customer"
                placeholder="Select Customer"
                data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
                value={reportCustomer}
                onChange={(v) => { setReportCustomer(v); setSelectedPart(null); setSelectedOp(null); }}
                clearable
                searchable
              />
              <Select
                label="Part Number"
                placeholder="Select Part"
                data={filteredReportParts.map((p: any) => ({ value: p.id, label: p.partNumber }))}
                value={selectedPart}
                onChange={(v) => { setSelectedPart(v); setSelectedOp(null); }}
                searchable
              />
              <Select
                label="Operation"
                placeholder="Select Operation"
                disabled={!selectedPart}
                data={operations.map(o => ({ value: o.id, label: o.operationNumber }))}
                value={selectedOp}
                onChange={setSelectedOp}
                searchable
              />
              <Select
                label="M/C No"
                placeholder="Select M/C"
                data={reportCustomerMachines.length > 0 ? reportCustomerMachines : (selectedMcNo ? [selectedMcNo] : [])}
                value={selectedMcNo}
                onChange={(val) => setSelectedMcNo(val || '')}
                clearable
                searchable
                disabled={reportCustomerMachines.length === 0}
              />
              <Button 
                onClick={handleGenerateReport} 
                loading={isDailyFetching} 
                disabled={!selectedPart || !selectedOp}
                leftSection={<Search size={16} />}
                style={{ alignSelf: 'end' }}
              >
                Generate Report
              </Button>
            </SimpleGrid>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Approval Modal */}
      <Modal 
        opened={!!approvalId} 
        onClose={() => { setApprovalId(null); setReviewedChecked(false); }}
        title="Confirm Approval"
      >
        <Text size="sm" mb="md">
          Are you sure you want to approve this inspection? You must read and verify the values before approving.
        </Text>
        <Checkbox 
          label="I confirm that I have reviewed the full report and validated the values."
          checked={reviewedChecked}
          onChange={(e) => setReviewedChecked(e.currentTarget.checked)}
          mb="lg"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => { setApprovalId(null); setReviewedChecked(false); }}>Cancel</Button>
          <Button 
            color="violet" 
            disabled={!reviewedChecked}
            loading={approveMutation.isPending}
            onClick={() => {
              if (approvalId) approveMutation.mutate(approvalId);
            }}
          >
            Approve
          </Button>
        </Group>
      </Modal>

      {/* Feature 5: Take Action (Correction) Modal */}
      <Modal
        opened={!!correctionTx}
        onClose={() => { setCorrectionTx(null); setCorrectionValues({}); setCorrectionRemarks(''); }}
        title="Take Action — Correct Failed Parameters"
        size="lg"
      >
        {correctionTx && (
          <div>
            <Paper withBorder p="sm" radius="md" mb="md" className="bg-red-50 dark:bg-red-900/20">
              <Group gap="xs" mb="xs">
                <Badge color="red" variant="filled" size="sm">REJECTED</Badge>
                <Text size="sm" fw={600}>
                  {correctionTx.part?.partNumber} / {correctionTx.operation?.operationNumber}
                </Text>
              </Group>
              <Text size="xs" c="dimmed">
                {correctionTx.shift?.name} — {correctionTx.intervalName} — {new Date(correctionTx.inspectionTimestamp).toLocaleString()}
              </Text>
            </Paper>

            <Text size="sm" fw={600} mb="sm">Failed Parameters (editable):</Text>

            <Table withTableBorder withColumnBorders verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Parameter</Table.Th>
                  <Table.Th>Specification</Table.Th>
                  <Table.Th>Original Value</Table.Th>
                  <Table.Th>Corrected Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {correctionTx.details?.filter((d: any) => d.status === 'FAIL').map((detail: any) => (
                  <Table.Tr key={detail.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>{detail.parameter?.parameterName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{detail.parameter?.specText || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color="red" variant="light">{detail.observedValue}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {(() => {
                        const getCorrectionStatus = (detail: any, val: string | undefined): 'PASS' | 'FAIL' | null => {
                          if (val === undefined || val === null || val.trim() === '') return null;
                          if (detail.parameter?.controlLimitMin !== null && detail.parameter?.controlLimitMax !== null) {
                            const numVal = parseFloat(val);
                            if (isNaN(numVal)) return 'FAIL';
                            const EPSILON = 1e-6;
                            if (numVal < detail.parameter.controlLimitMin - EPSILON || numVal > detail.parameter.controlLimitMax + EPSILON) return 'FAIL';
                            return 'PASS';
                          } else {
                            const lower = val.toLowerCase().trim();
                            if (lower === 'ng' || lower === 'fail') return 'FAIL';
                            if (/\b(ng|fail|reject|rejected|not ok)\b/.test(lower)) return 'FAIL';
                            return 'PASS';
                          }
                        };
                        const status = getCorrectionStatus(detail, correctionValues[detail.id]);
                        
                        return (
                          <Group gap="xs" wrap="nowrap">
                            <Box style={{ flex: 1 }}>
                      {detail.parameter?.controlLimitMin !== null ? (
                        <TextInput
                          size="sm"
                          value={correctionValues[detail.id] || ''}
                          onChange={(e) => setCorrectionValues(prev => ({ ...prev, [detail.id]: e.target.value }))}
                          onBlur={(e) => {
                            const val = e.target.value;
                            const lc = detail.parameter?.leastCount;
                            if (lc && lc > 0) {
                              const decimalPlaces = Math.round(-Math.log10(lc));
                              const parts = val.split('.');
                              if (parts.length === 2 && parts[1].length > decimalPlaces) {
                                setCorrectionValues(prev => ({ ...prev, [detail.id]: parseFloat(val).toFixed(decimalPlaces) }));
                              }
                            }
                          }}
                          placeholder="Enter corrected value"
                          type="number"
                          inputMode="decimal"
                          step={detail.parameter?.leastCount && detail.parameter.leastCount > 0 ? String(detail.parameter.leastCount) : '0.001'}
                        />
                      ) : (
                        <Autocomplete
                          size="sm"
                          value={correctionValues[detail.id] || ''}
                          onChange={(val) => setCorrectionValues(prev => ({ ...prev, [detail.id]: val }))}
                          placeholder="Select or type OK/NG"
                          data={['OK', 'NG']}
                        />
                      )}
                            </Box>
                            {status && (
                              <Badge color={status === 'PASS' ? 'green' : 'red'} variant="filled" size="sm" style={{ flexShrink: 0 }}>
                                {status}
                              </Badge>
                            )}
                          </Group>
                        );
                      })()}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Textarea
              label="Correction Remarks"
              placeholder="Reason for correction..."
              value={correctionRemarks}
              onChange={(e) => setCorrectionRemarks(e.target.value)}
              mt="md"
            />

            <Group justify="flex-end" mt="lg">
              <Button variant="default" onClick={() => { setCorrectionTx(null); setCorrectionValues({}); setCorrectionRemarks(''); }}>
                Cancel
              </Button>
              <Button
                color="orange"
                loading={correctionMutation.isPending}
                onClick={handleSubmitCorrections}
                leftSection={<Wrench size={16} />}
              >
                Submit Corrections
              </Button>
            </Group>
          </div>
        )}
      </Modal>

      {/* Feature 5: Audit Trail Drawer */}
      <Modal
        opened={!!auditTrailId}
        onClose={() => { setAuditTrailId(null); setAuditTrailData([]); }}
        title="Audit Trail — Correction History"
        size="lg"
      >
        {auditTrailData.length === 0 ? (
          <Paper withBorder p="xl" radius="md">
            <Text ta="center" c="dimmed">No corrections have been made to this inspection.</Text>
          </Paper>
        ) : (
          <Timeline active={auditTrailData.length - 1} bulletSize={28} lineWidth={2}>
            {auditTrailData.map((entry) => (
              <Timeline.Item
                key={entry.id}
                bullet={
                  <ThemeIcon
                    size={28}
                    variant="filled"
                    color={entry.correctedStatus === 'PASS' ? 'green' : 'orange'}
                    radius="xl"
                  >
                    <Wrench size={14} />
                  </ThemeIcon>
                }
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={600}>{entry.detail?.parameter?.parameterName || 'Parameter'}</Text>
                    <Badge
                      color={entry.correctedStatus === 'PASS' ? 'green' : 'red'}
                      variant="light"
                      size="xs"
                    >
                      {entry.correctedStatus}
                    </Badge>
                  </Group>
                }
              >
                <Group gap="sm" mt="xs">
                  <Badge color="red" variant="light" size="sm">{entry.previousValue}</Badge>
                  <ArrowRight size={14} className="text-gray-400" />
                  <Badge color="green" variant="light" size="sm">{entry.correctedValue}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  By {entry.correctedBy?.name || 'Unknown'} at {new Date(entry.correctedAt).toLocaleString()}
                </Text>
                {entry.remarks && (
                  <Text size="xs" c="dimmed" fs="italic" mt={2}>
                    Remarks: {entry.remarks}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Modal>

      {/* Daily Audit Report Display (A4 Landscape Print Format) */}
      {activeTab === 'daily' && dailyReportTransactions.length > 0 && (
        <div className="mt-2 print:mt-0">
          <Group justify="flex-end" mb="md" className="print:hidden">
            <Button leftSection={<Printer size={16} />} onClick={handlePrint} color="teal">
              Print Daily Check Sheet
            </Button>
          </Group>

          <Paper withBorder p="xl" className="print:border-0 print:p-0 bg-white dark:bg-[#1a1b1e] shadow-sm overflow-x-auto print:overflow-visible text-black dark:text-gray-200">
            <div className="min-w-[900px] print:min-w-full">
              {/* Header Box matching original sample.pdf format */}
              <div className="border border-black dark:border-gray-600 flex items-stretch text-sm font-medium mb-2 bg-white dark:bg-[#25262b] text-black dark:text-gray-200">
                {/* Left section: Logo + Company info + Date / Machine info */}
                <div className="w-[35%] p-3 border-r border-black flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/tvs_logo.jpeg" alt="TVS Logo" className="h-10 w-auto object-contain" />
                    <div>
                      <div className="font-bold text-lg mb-1 text-[#000080] dark:text-blue-300">Sundram Fasteners Limited,</div>
                      <div className="text-xs text-[#000080] dark:text-blue-300">Autolec Division, Plant - II.</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div>Date : <span className="font-bold pl-1">{selectedDate ? selectedDate.toLocaleDateString() : 'N/A'}</span></div>
                    <div>M/c No. : <span className="font-bold pl-1">{selectedMcNo || dailyReportTransactions[0]?.mcNo || 'N/A'}</span></div>
                  </div>
                </div>
                
                {/* Middle section: Check sheet title and reference */}
                <div className="w-[38%] p-3 border-r border-black flex flex-col justify-center items-center text-center">
                  <Text size="lg" fw={900} className="text-black uppercase font-black tracking-wide leading-tight">Inspector - Inprocess Check Sheet</Text>
                </div>

                {/* Right section: Part number, Part name, Operation number */}
                <div className="w-[27%] p-3 flex flex-col justify-center items-end text-xs pr-4 bg-white dark:bg-[#25262b] text-black dark:text-white">
                  <div className="space-y-1.5 text-left">
                    <div className="flex items-center">
                      <span className="font-semibold text-black whitespace-nowrap" style={{ width: '100px', display: 'inline-block' }}>PART NO:</span>
                      <span className="font-bold  text-black">{currentPartInfo?.partNumber || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-semibold text-black whitespace-nowrap" style={{ width: '100px', display: 'inline-block' }}>PART NAME:</span>
                      <span className="font-bold  text-black">{currentPartInfo?.partName || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-semibold text-black whitespace-nowrap" style={{ width: '100px', display: 'inline-block' }}>Operation No.:</span>
                      <span className="font-bold  text-black">{operations.find(o => o.id === selectedOp)?.operationNumber || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Table Grid */}
              <Table withTableBorder withColumnBorders borderColor="#000" verticalSpacing="xs" horizontalSpacing="xs" style={{ borderCollapse: 'collapse' }} className="dark:text-gray-200">
                <Table.Thead className="bg-gray-50 dark:bg-[#25262b] text-center font-bold text-xs">
                  <Table.Tr>
                    <Table.Th rowSpan={2} style={{ width: 45 }} className="text-center">S. No.</Table.Th>
                    <Table.Th rowSpan={2} className="text-center">Description</Table.Th>
                    {/* Specification header spans 3 columns and 2 rows */}
                    <Table.Th rowSpan={2} className="text-center">MISP NO/SC</Table.Th>
                    <Table.Th rowSpan={2} style={{ width: 170 }} className="text-center">Specification (Standard)</Table.Th>
                    <Table.Th rowSpan={2} style={{ width: 120 }} className="text-center">Method of checking</Table.Th>
                    <Table.Th rowSpan={2} style={{ width: 90 }} className="text-center">Freq. of Inspn.</Table.Th>
                    <Table.Th colSpan={2} className="text-center bg-blue-50 dark:bg-blue-900/20 text-black dark:text-white">1st Shift (Shift A)</Table.Th>
                    <Table.Th colSpan={2} className="text-center bg-teal-50 dark:bg-teal-900/20 text-black dark:text-white">2nd Shift (Shift B)</Table.Th>
                    <Table.Th colSpan={2} className="text-center bg-orange-50 dark:bg-orange-900/20 text-black dark:text-white">3rd Shift (Shift C)</Table.Th>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th style={{ width: 85 }} className="text-center bg-blue-50/50 dark:bg-blue-900/10">1 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-blue-50/50 dark:bg-blue-900/10">2 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-teal-50/50 dark:bg-teal-900/10">1 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-teal-50/50 dark:bg-teal-900/10">2 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-orange-50/50 dark:bg-orange-900/10">1 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-orange-50/50 dark:bg-orange-900/10">2 Half</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody className="text-xs">
                  {parameters.map((param, index) => {
                    return (
                      <Table.Tr key={param.id} className="hover:bg-gray-50/30 dark:hover:bg-gray-800/30">
                        <Table.Td className="text-center font-semibold">{String(index + 1).padStart(2, '0')}</Table.Td>
                        <Table.Td className="font-semibold">{param.parameterName}</Table.Td>
                        
                        <Table.Td className="font-semibold">{param.class}</Table.Td>
                        <Table.Td className="text-center font-medium">{param.specText || `${param.nominalValue} ±${param.upperTolerance}`}</Table.Td>
                        
                        <Table.Td className="text-center">{param.methodOfChecking || '-'}</Table.Td>
                        <Table.Td className="text-center font-medium">{param.freqOfInspn || '-'}</Table.Td>
                        
                        {/* Observation cells aligned per Shift and Interval */}
                        {isOncePerDay(param) ? (
                          <>{getMergedCellContentDay(param)}</>
                        ) : isOncePerShift(param) ? (
                          <>
                            <Table.Td p={0} colSpan={2}>{getMergedCellContent('Shift A', param)}</Table.Td>
                            <Table.Td p={0} colSpan={2}>{getMergedCellContent('Shift B', param)}</Table.Td>
                            <Table.Td p={0} colSpan={2}>{getMergedCellContent('Shift C', param)}</Table.Td>
                          </>
                        ) : (
                          <>
                            <Table.Td p={0}>{getCellContent('Shift A', '1 Half', param)}</Table.Td>
                            <Table.Td p={0}>{getCellContent('Shift A', '2 Half', param)}</Table.Td>
                            <Table.Td p={0}>{getCellContent('Shift B', '1 Half', param)}</Table.Td>
                            <Table.Td p={0}>{getCellContent('Shift B', '2 Half', param)}</Table.Td>
                            <Table.Td p={0}>{getCellContent('Shift C', '1 Half', param)}</Table.Td>
                            <Table.Td p={0}>{getCellContent('Shift C', '2 Half', param)}</Table.Td>
                          </>
                        )}
                      </Table.Tr>
                    );
                  })}
                  
                  {/* Status / Verifications Footer */}
                  <Table.Tr className="bg-gray-50/50 dark:bg-[#25262b]/50 font-bold">
                    <Table.Td colSpan={6} className="text-right pr-4 font-bold">OK / NG</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift A', '1 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift A', '2 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift B', '1 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift B', '2 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift C', '1 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift C', '2 Half')}</Table.Td>
                  </Table.Tr>
                  <Table.Tr className="bg-gray-50/50 dark:bg-[#25262b]/50 font-medium">
                    <Table.Td colSpan={6} className="text-right pr-4">Inspected by</Table.Td>
                    <Table.Td className="text-center text-[10px]">
                      {getInspectorSignature('Shift A', '1 Half') || getFooterInspector('Shift A', '1 Half')}
                    </Table.Td>
                    <Table.Td className="text-center text-[10px]">
                      {getInspectorSignature('Shift A', '2 Half') || getFooterInspector('Shift A', '2 Half')}
                    </Table.Td>
                    <Table.Td className="text-center text-[10px]">
                      {getInspectorSignature('Shift B', '1 Half') || getFooterInspector('Shift B', '1 Half')}
                    </Table.Td>
                    <Table.Td className="text-center text-[10px]">
                      {getInspectorSignature('Shift B', '2 Half') || getFooterInspector('Shift B', '2 Half')}
                    </Table.Td>
                    <Table.Td className="text-center text-[10px]">
                      {getInspectorSignature('Shift C', '1 Half') || getFooterInspector('Shift C', '1 Half')}
                    </Table.Td>
                    <Table.Td className="text-center text-[10px]">
                      {getInspectorSignature('Shift C', '2 Half') || getFooterInspector('Shift C', '2 Half')}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr className="bg-gray-50/50 dark:bg-[#25262b]/50 font-medium">
                    <Table.Td colSpan={6} className="text-right pr-4">Checked by</Table.Td>
                    <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift A')}</Table.Td>
                    <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift B')}</Table.Td>
                    <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift C')}</Table.Td>
                  </Table.Tr>
                  <Table.Tr className="bg-gray-50/50 dark:bg-[#25262b]/50 font-medium print:hidden">
                    <Table.Td colSpan={6} className="text-right pr-4">Approve</Table.Td>
                    {['Shift A', 'Shift B', 'Shift C'].map(shift => {
                      const unapproved = getUnapprovedTxIds(shift);
                      return (
                        <Table.Td key={shift} colSpan={2} className="text-center">
                          {canApprove && unapproved.length > 0 ? (
                            <Tooltip label={`Approve ${unapproved.length} transaction(s) for ${shift}`}>
                              <Button
                                size="compact-xs"
                                color="yellow"
                                variant="filled"
                                leftSection={<CheckCircle size={12} />}
                                loading={approveMutation.isPending}
                                onClick={() => {
                                  modals.openConfirmModal({
                                    title: 'Confirm Approval',
                                    children: (
                                      <Text size="sm">
                                        Are you sure you want to approve this report for {shift}? Your signature will be permanently attached.
                                      </Text>
                                    ),
                                    labels: { confirm: 'Yes, Approve', cancel: 'Cancel' },
                                    confirmProps: { color: 'green' },
                                    onConfirm: () => {
                                      unapproved.forEach(id => approveMutation.mutate(id));
                                    },
                                  });
                                }}
                              >
                                Approve Needed
                              </Button>
                            </Tooltip>
                          ) : unapproved.length === 0 && dailyReportTransactions.some(t => t.shift?.name === shift) ? (
                            <Badge color="green" variant="light" size="xs">Approved</Badge>
                          ) : (
                            <Text size="xs" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                </Table.Tbody>
              </Table>

              {/* Bottom Metadata & Notes Section */}
              <div className="mt-4 border border-gray-300 dark:border-gray-600 p-3 rounded-sm flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-50/20 dark:bg-[#25262b]/20">
                <div style={{ width: '40%' }}>
                  <Text fw={700} mb="xs">Abbreviations</Text>
                  <Table withTableBorder withColumnBorders verticalSpacing="xs" horizontalSpacing="xs" style={{ width: '100%' }}>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td style={{ width: 50 }} className="text-center font-bold">NP</Table.Td>
                        <Table.Td>No Production</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td className="text-center font-bold">SC</Table.Td>
                        <Table.Td>Significant Characteristic</Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                  <Text size="xs" className="text-gray-500 font-medium mt-2 block text-left">TAF / P2 / 9.1B JAN-2012 (Rev date: 06.10.2023)</Text>
                </div>
                
                <div style={{ width: '55%' }}>
                  <Text fw={700} mb="xs">Remarks / Observations Log</Text>
                  <Paper withBorder p="xs" style={{ minHeight: 60 }} className="bg-white dark:bg-[#25262b]">
                    <Text size="xs" className="italic text-gray-600">
                      {getRemarksText()}
                    </Text>
                  </Paper>
                </div>
              </div>
            </div>
          </Paper>
        </div>
      )}

      {activeTab === 'daily' && dailyReportTransactions.length === 0 && (
        <Paper withBorder p="xl" mt="md" radius="md" className="print:hidden">
          <Text ta="center" c="dimmed">
            No inspection readings logged yet for the selected Part, Operation, and Date. Try clicking "Generate Report" above.
          </Text>
        </Paper>
      )}
    </div>
  );
}
