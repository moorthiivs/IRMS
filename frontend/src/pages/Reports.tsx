import { useState } from 'react';
import { 
  Title, Paper, Table, Group, Badge, ActionIcon, 
  Tabs, Select, TextInput, Button, Text, Tooltip,
  Modal, Checkbox, SimpleGrid, Textarea, Timeline, ThemeIcon, Autocomplete
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Printer, FileText, Search, LayoutGrid, CheckCircle, FileCheck, Wrench, History, ArrowRight, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import { useAuthStore } from '../store/auth-store';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { TableSkeleton } from '../components/TableSkeleton';
import { CorrectionEntry } from '../types';

function parseSpecText(specText: string | null): [string, string, string] {
  if (!specText) return ['', '', ''];
  const text = specText.trim();
  
  // 1. ± symbol
  if (text.includes('±')) {
    const parts = text.split('±');
    return [parts[0].trim(), '±', parts[1].trim()];
  }
  
  // 2. regex for ± / + / - / ~
  const plusMinusRegex = /^([A-Za-z0-9\.\,\s\-]+)\s*([\+\-~])\s*([A-Za-z0-9\.\(\)\s\-]+)$/;
  const match = text.match(plusMinusRegex);
  if (match) {
    return [match[1].trim(), match[2].trim(), match[3].trim()];
  }
  
  // 3. Check for "ref"
  if (text.toLowerCase().includes('ref')) {
    const index = text.toLowerCase().indexOf('ref');
    const firstPart = text.substring(0, index).trim();
    const thirdPart = text.substring(index + 3).trim();
    return [firstPart, 'ref', thirdPart];
  }
  
  // 4. Check for "max." or "max" or "min." or "min"
  const maxMinRegex = /^(.*?)\s*(max\.?|min\.?)$/i;
  const maxMinMatch = text.match(maxMinRegex);
  if (maxMinMatch) {
    return [maxMinMatch[1].trim(), '', maxMinMatch[2].trim()];
  }
  
  // 5. Check for "Rz 6.300" type format
  const rzRegex = /^(Rz)\s+([0-9\.]+)$/i;
  const rzMatch = text.match(rzRegex);
  if (rzMatch) {
    return [rzMatch[1].trim(), '', rzMatch[2].trim()];
  }

  // 6. Check for ending parenthesis (e.g. 133.60,12.40 (0.20))
  const parenRegex = /^([A-Za-z0-9\.\,\s\-]+)\s*(\([A-Za-z0-9\.\,\s\-]+\))$/;
  const parenMatch = text.match(parenRegex);
  if (parenMatch) {
    return [parenMatch[1].trim(), '', parenMatch[2].trim()];
  }
  
  return [text, '', ''];
}

export function Reports() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [activeTab, setActiveTab] = useState<string | null>('history');
  const [searchParams, setSearchParams] = useSearchParams();
  const filterStatus = searchParams.get('status');
  const filterApproval = searchParams.get('approval');

  // History Tab filter states
  const [historyDate, setHistoryDate] = useState<Date | null>(null);
  const [historyShift, setHistoryShift] = useState<string | null>(null);

  // Report filter states
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

  // 1. Transaction History Query
  const { data: recent = [], isLoading: isRecentLoading } = useQuery({
    queryKey: ['recent-inspections', filterStatus, filterApproval, historyDate, historyShift],
    queryFn: () => {
      const formattedDate = historyDate ? 
        `${historyDate.getFullYear()}-${String(historyDate.getMonth() + 1).padStart(2, '0')}-${String(historyDate.getDate()).padStart(2, '0')}` 
        : undefined;
      return inspectionService.getRecent({ 
        status: filterStatus, 
        approval: filterApproval,
        date: formattedDate,
        shiftId: historyShift || undefined
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

  const { data: operations = [] } = useQuery({
    queryKey: ['operations', selectedPart],
    queryFn: () => masterDataService.getOperationsByPart(selectedPart!),
    enabled: !!selectedPart
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
              <line x1="0" y1="100" x2="100" y2="0" stroke="#dee2e6" strokeWidth="1" />
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
              <line x1="0" y1="100" x2="100" y2="0" stroke="#dee2e6" strokeWidth="1" />
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
      <div className={`text-center text-xs font-semibold ${singleReading.status === 'FAIL' ? 'text-red-600' : 'text-gray-800'}`}>
        {singleReading.observedValue}
      </div>
    );
  };

  const isOncePerShift = (param: any) => {
    const freq = String(param.freqOfInspn || '').toLowerCase().trim();
    return freq === '1' || freq === 'once per shift' || freq === '1no/shift' || freq === '1/shift' || freq === '1/day';
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
      <div className={`text-center text-xs font-semibold ${r.status === 'FAIL' ? 'text-red-600' : 'text-gray-800'}`}>
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

  return (
    <div>
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

      <Group justify="space-between" mb="lg" className="print:hidden">
        <Title order={2}>Inspection Reports</Title>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} className="print:hidden">
        <Tabs.List mb="lg">
          <Tabs.Tab value="history" leftSection={<FileText size={16} />}>
            Individual Submissions
          </Tabs.Tab>
          <Tabs.Tab value="daily" leftSection={<LayoutGrid size={16} />}>
            Daily Audit Check Sheet
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="history">
          <Paper withBorder p="sm" radius="md" mb="md" className="bg-blue-50">
            <Group justify="space-between" align="center">
              <Group gap="xs" align="center">
                <Text size="sm" fw={600} mr="sm">Filters:</Text>
                <DatePickerInput
                  placeholder="Select Date"
                  size="xs"
                  value={historyDate}
                  onChange={setHistoryDate}
                  clearable
                  style={{ width: 140 }}
                />
                <Select
                  placeholder="Select Shift"
                  size="xs"
                  data={shifts.map((s: any) => ({ value: s.id, label: s.name }))}
                  value={historyShift}
                  onChange={setHistoryShift}
                  clearable
                  style={{ width: 150 }}
                />
                {filterStatus && (
                  <Badge color={filterStatus === 'PASSED' ? 'green' : 'red'} variant="filled">
                    {filterStatus}
                  </Badge>
                )}
                {filterApproval === 'pending' && (
                  <Badge color="violet" variant="filled">
                    Approval Pending
                  </Badge>
                )}
              </Group>
              <Button
                size="xs"
                variant="subtle"
                onClick={() => {
                  setSearchParams({});
                  setHistoryDate(null);
                  setHistoryShift(null);
                }}
              >
                Clear Filters
              </Button>
            </Group>
          </Paper>
          <Paper withBorder p="md" radius="md">
            {isRecentLoading ? (
              <TableSkeleton rows={8} />
            ) : (
              <div className="overflow-x-auto">
                <Table striped highlightOnHover style={{ minWidth: 900 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date & Time</Table.Th>
                    <Table.Th>Part / Operation</Table.Th>
                    <Table.Th>Shift</Table.Th>
                    <Table.Th>Lot No</Table.Th>
                    <Table.Th>Inspector</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th style={{ minWidth: 120 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {recent.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>{new Date(item.inspectionTimestamp).toLocaleString()}</Table.Td>
                      <Table.Td>{item.part?.partNumber} / {item.operation?.operationNumber}</Table.Td>
                      <Table.Td>{item.shift?.name}</Table.Td>
                      <Table.Td>{item.lotNumber}</Table.Td>
                      <Table.Td>{item.inspector?.name}</Table.Td>
                      <Table.Td>
                        <Badge color={item.status === 'PASSED' ? 'green' : 'red'}>
                          {item.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs" wrap="nowrap">
                          <ActionIcon variant="light" color="blue" onClick={() => navigate(`/reports/${item.id}`)}>
                            <Eye size={16} />
                          </ActionIcon>
                          <ActionIcon variant="light" color="gray" onClick={() => navigate(`/reports/${item.id}`)}>
                            <Printer size={16} />
                          </ActionIcon>
                          {/* Feature 5: Take Action for rejected reports */}
                          {item.status === 'REJECTED' && (
                            <Tooltip label="Take Action — Correct failed values">
                              <ActionIcon
                                variant="light"
                                color="orange"
                                onClick={() => handleTakeAction(item.id)}
                              >
                                <Wrench size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                          {/* Feature 5: Audit Trail */}
                          <Tooltip label="View Audit Trail">
                            <ActionIcon
                              variant="light"
                              color="cyan"
                              onClick={() => handleViewAuditTrail(item.id)}
                            >
                              <History size={16} />
                            </ActionIcon>
                          </Tooltip>
                          {item.status === 'PASSED' && !item.approvedById && isAdmin && (
                            <ActionIcon
                              variant="light"
                              color="violet"
                              onClick={() => {
                                setApprovalId(item.id);
                                setReviewedChecked(false);
                              }}
                              loading={approveMutation.isPending && approvalId === item.id}
                            >
                              <FileCheck size={16} />
                            </ActionIcon>
                          )}
                          {isAdmin && (
                            <Tooltip label="Delete Report">
                              <ActionIcon
                                variant="light"
                                color="red"
                                onClick={() => handleDelete(item.id)}
                                loading={deleteMutation.isPending}
                              >
                                <Trash2 size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="daily">
          <Paper withBorder p="md" radius="md" mb="lg">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
              <DatePickerInput
                label="Select Date"
                placeholder="Select date"
                value={selectedDate}
                onChange={setSelectedDate}
                clearable
              />
              <Select
                label="Part Number"
                placeholder="Select Part"
                data={parts.map(p => ({ value: p.id, label: p.partNumber }))}
                value={selectedPart}
                onChange={(v) => { setSelectedPart(v); setSelectedOp(null); }}
              />
              <Select
                label="Operation"
                placeholder="Select Operation"
                disabled={!selectedPart}
                data={operations.map(o => ({ value: o.id, label: o.operationNumber }))}
                value={selectedOp}
                onChange={setSelectedOp}
              />
              <TextInput
                label="M/C No. (Optional)"
                placeholder="e.g. CNC80"
                value={selectedMcNo}
                onChange={(e) => setSelectedMcNo(e.target.value)}
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
            <Paper withBorder p="sm" radius="md" mb="md" className="bg-red-50">
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

          <Paper withBorder p="xl" className="print:border-0 print:p-0 bg-white shadow-sm overflow-x-auto print:overflow-visible">
            <div className="min-w-[900px] print:min-w-full">
              {/* Header Box matching original sample.pdf format */}
              <div className="border border-black flex items-stretch text-sm font-medium mb-2 bg-white text-black">
                {/* Left section: Logo + Company info + Date / Machine info */}
                <div className="w-[35%] p-3 border-r border-black flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <img src="/tvs_logo.jpeg" alt="TVS Logo" className="h-10 w-auto object-contain" />
                    <div>
                      <Text size="sm" fw={800} className="text-black font-extrabold leading-tight">Sundram Fasteners Limited,</Text>
                      <Text size="xs" className="text-gray-700 font-semibold leading-tight">Autolec Division, Plant - II.</Text>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div>Date : <span className="font-bold underline pl-1">{selectedDate ? selectedDate.toLocaleDateString() : 'N/A'}</span></div>
                    <div>M/c No. : <span className="font-bold underline pl-1">{selectedMcNo || dailyReportTransactions[0]?.mcNo || 'N/A'}</span></div>
                  </div>
                </div>
                
                {/* Middle section: Check sheet title and reference */}
                <div className="w-[38%] p-3 border-r border-black flex flex-col justify-center items-center text-center">
                  <Text size="lg" fw={900} className="text-black uppercase font-black tracking-wide leading-tight">Inspector - Inprocess Check Sheet</Text>
                  <Text size="xs" className="text-gray-600 font-medium mt-1">TAF / P2 / 9.1B JAN-2012 (Rev date: 06.10.2023)</Text>
                </div>

                {/* Right section: Part number, Part name, Operation number */}
                <div className="w-[27%] p-3 flex flex-col justify-center items-end text-xs pr-4 bg-white text-black">
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
              <Table withTableBorder withColumnBorders verticalSpacing="xs" horizontalSpacing="xs" style={{ borderCollapse: 'collapse' }}>
                <Table.Thead className="bg-gray-50 text-center font-bold text-xs">
                  <Table.Tr>
                    <Table.Th rowSpan={2} style={{ width: 45 }} className="text-center">S. No.</Table.Th>
                    <Table.Th rowSpan={2} className="text-center">Description</Table.Th>
                    {/* Specification header spans 3 columns and 2 rows */}
                    <Table.Th rowSpan={2} className="text-center">MISP NO/SC</Table.Th>
                    <Table.Th colSpan={3} rowSpan={2} style={{ width: 170 }} className="text-center">Specification (Standard)</Table.Th>
                    <Table.Th rowSpan={2} style={{ width: 120 }} className="text-center">Method of checking</Table.Th>
                    <Table.Th rowSpan={2} style={{ width: 90 }} className="text-center">Freq. of Inspn.</Table.Th>
                    <Table.Th colSpan={2} className="text-center bg-blue-50">1st Shift (Shift A)</Table.Th>
                    <Table.Th colSpan={2} className="text-center bg-teal-50">2nd Shift (Shift B)</Table.Th>
                    <Table.Th colSpan={2} className="text-center bg-orange-50">3rd Shift (Shift C)</Table.Th>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Th style={{ width: 85 }} className="text-center bg-blue-50/50">1 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-blue-50/50">2 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-teal-50/50">1 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-teal-50/50">2 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-orange-50/50">1 Half</Table.Th>
                    <Table.Th style={{ width: 85 }} className="text-center bg-orange-50/50">2 Half</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody className="text-xs">
                  {parameters.map((param, index) => {
                    const [nominal, symbol, limit] = parseSpecText(param.specText || `${param.nominalValue} ±${param.upperTolerance}`);
                    return (
                      <Table.Tr key={param.id} className="hover:bg-gray-50/30">
                        <Table.Td className="text-center font-semibold">{String(index + 1).padStart(2, '0')}</Table.Td>
                        <Table.Td className="font-semibold">{param.parameterName}</Table.Td>
                        
                        {/* 3 Split Specification Columns */}
                        <Table.Td className="font-semibold">{param.class}</Table.Td>
                        <Table.Td style={{ width: 80 }} className="text-right pr-2 font-medium">{nominal || '-'}</Table.Td>
                        <Table.Td style={{ width: 30 }} className="text-center font-bold text-gray-500">{symbol}</Table.Td>
                        <Table.Td style={{ width: 60 }} className="text-left pl-2 font-medium">{limit}</Table.Td>
                        
                        <Table.Td className="text-center">{param.methodOfChecking || '-'}</Table.Td>
                        <Table.Td className="text-center font-medium">{param.freqOfInspn || '-'}</Table.Td>
                        
                        {/* Observation cells aligned per Shift and Interval */}
                        {isOncePerShift(param) ? (
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
                  <Table.Tr className="bg-gray-50/50 font-bold">
                    <Table.Td colSpan={8} className="text-right pr-4 font-bold">OK / NG</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift A', '1 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift A', '2 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift B', '1 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift B', '2 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift C', '1 Half')}</Table.Td>
                    <Table.Td className="text-center">{getFooterStatus('Shift C', '2 Half')}</Table.Td>
                  </Table.Tr>
                  <Table.Tr className="bg-gray-50/50 font-medium">
                    <Table.Td colSpan={8} className="text-right pr-4">Inspected by</Table.Td>
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
                  <Table.Tr className="bg-gray-50/50 font-medium">
                    <Table.Td colSpan={8} className="text-right pr-4">Checked by</Table.Td>
                    <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift A')}</Table.Td>
                    <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift B')}</Table.Td>
                    <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift C')}</Table.Td>
                  </Table.Tr>
                  <Table.Tr className="bg-gray-50/50 font-medium print:hidden">
                    <Table.Td colSpan={8} className="text-right pr-4">Approve</Table.Td>
                    {['Shift A', 'Shift B', 'Shift C'].map(shift => {
                      const unapproved = getUnapprovedTxIds(shift);
                      return (
                        <Table.Td key={shift} colSpan={2} className="text-center">
                          {isAdmin && unapproved.length > 0 ? (
                            <Tooltip label={`Approve ${unapproved.length} transaction(s) for ${shift}`}>
                              <Button
                                size="compact-xs"
                                color="green"
                                variant="light"
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
                                Approve
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
              <div className="mt-4 border border-gray-300 p-3 rounded-sm flex justify-between text-xs font-semibold text-gray-700 bg-gray-50/20">
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
                </div>
                
                <div style={{ width: '55%' }}>
                  <Text fw={700} mb="xs">Remarks / Observations Log</Text>
                  <Paper withBorder p="xs" style={{ minHeight: 60 }} className="bg-white">
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
