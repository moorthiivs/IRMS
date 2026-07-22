import { useState, useRef } from 'react';
import { Title, Paper, Group, Text, Select, Table, Badge, Center, Loader, Tabs, Button, ActionIcon, Collapse, Box, Checkbox, Modal, TextInput, Textarea, Autocomplete } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, FileText, LayoutList, ChevronDown, ChevronRight, CheckCircle2, Trash2, Wrench, Download } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import api from '../../lib/axios';
import { masterDataService } from '../../services/master-data.service';
import { settingsService } from '../../services/settings.service';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const commonUnits = ['mm', 'cm', 'm', 'kg', 'g', '°C', 'bar', 'psi', 'V', 'A', 'N', 'RPM', 'sec', 'min', 'pcs'];

// Helper component for expandable row
function TransactionRow({ txn, approveMutation, deleteMutation, isSelected, onToggleSelect, addCorrectionMutation }: { txn: any, approveMutation: any, deleteMutation: any, isSelected: boolean, onToggleSelect: () => void, addCorrectionMutation: any }) {
  const [expanded, setExpanded] = useState(false);
  const [takingAction, setTakingAction] = useState(false);
  const [corrections, setCorrections] = useState<{ [itemId: string]: string }>({});
  const [remarks, setRemarks] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const hasPassDetail = (itemId: string) => {
    return txn.details.some((d: any) => d.pokaYokeItemId === itemId && d.status === 'PASS');
  };

  const allItemsPassed = () => {
    const itemIds = Array.from(new Set(txn.details.map((d: any) => d.pokaYokeItemId)));
    return itemIds.every((itemId: any) => hasPassDetail(itemId));
  };

  const allPassed = allItemsPassed();

  const failedItemIds = Array.from(new Set(txn.details.map((d: any) => d.pokaYokeItemId))).filter((itemId: any) => !hasPassDetail(itemId));
  const failedItems = failedItemIds.map(itemId => txn.details.find((d: any) => d.pokaYokeItemId === itemId && d.status === 'FAIL')).filter(Boolean);

  const handleCorrectionSubmit = () => {
    const formattedCorrections = Object.entries(corrections)
      .filter(([_, val]) => val.trim() !== '')
      .map(([itemId, val]) => ({ pokaYokeItemId: itemId, observedValue: val }));
    
    if (formattedCorrections.length === 0) return;

    addCorrectionMutation.mutate(
      {
        transactionId: txn.id,
        corrections: formattedCorrections,
        remarks,
      },
      {
        onSuccess: () => {
          setTakingAction(false);
        }
      }
    );
  };

  const itemIds = Array.from(new Set(txn.details.map((d: any) => d.pokaYokeItemId)));
  const latestDetails = itemIds.map((itemId: any) => {
    const itemDetails = txn.details.filter((d: any) => d.pokaYokeItemId === itemId);
    const passDetail = itemDetails.find((d: any) => d.status === 'PASS');
    return passDetail || itemDetails[itemDetails.length - 1];
  });
  
  const displayDetails = showHistory ? txn.details : latestDetails;
  const hasHistory = txn.details.length > itemIds.length;

  return (
    <>
      <Table.Tr bg={isSelected ? 'var(--mantine-color-blue-light)' : undefined}>
        <Table.Td>
          <Checkbox checked={isSelected} onChange={onToggleSelect} />
        </Table.Td>
        <Table.Td>
          <ActionIcon variant="subtle" color="gray" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </ActionIcon>
        </Table.Td>
        <Table.Td>{format(new Date(txn.date), 'MMMM d, yyyy')}</Table.Td>
        <Table.Td>{txn.part?.partNumber} - {txn.part?.partName}</Table.Td>
        <Table.Td>{txn.shiftId || 'N/A'}</Table.Td>
        <Table.Td>{txn.inspector?.name}</Table.Td>
        <Table.Td>
          <Badge color={txn.status === 'PASSED' || txn.status === 'APPROVED' ? 'green' : (txn.status === 'REJECTED' && allPassed ? 'blue' : 'red')} variant="filled">
            {txn.status === 'REJECTED' && allPassed ? 'FIXED' : txn.status}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            {!txn.adminId && allPassed && (
              <Button 
                size="xs" 
                color="green" 
                variant="light"
                leftSection={<CheckCircle2 size={14} />}
                onClick={() => approveMutation.mutate(txn.id)}
                loading={approveMutation.isPending}
              >
                Approve
              </Button>
            )}
            {!txn.adminId && !allPassed && (
              <Button 
                size="xs" 
                color="orange" 
                variant="filled"
                leftSection={<Wrench size={14} />}
                onClick={() => {
                  setTakingAction(true);
                  setCorrections({});
                  setRemarks('');
                }}
              >
                Take Action
              </Button>
            )}
            {txn.adminId && (
              <Text size="xs" c="dimmed">Approved</Text>
            )}
            <ActionIcon
              color="red"
              variant="subtle"
              onClick={() => {
                modals.openConfirmModal({
                  title: 'Delete Transaction',
                  children: <Text size="sm">Are you sure you want to delete this submission? This action cannot be undone.</Text>,
                  labels: { confirm: 'Delete', cancel: 'Cancel' },
                  confirmProps: { color: 'red' },
                  onConfirm: () => deleteMutation.mutate(txn.id),
                });
              }}
              loading={deleteMutation.isPending}
            >
              <Trash2 size={16} />
            </ActionIcon>
          </Group>
        </Table.Td>
      </Table.Tr>
      <Table.Tr>
        <Table.Td colSpan={8} p={0}>
          <Collapse in={expanded}>
            <Box p="md" bg="gray.0" className="dark:bg-[#1a1b1e]">
              <Group justify="space-between" mb="sm">
                <Text fw={600} size="sm">Transaction Details</Text>
                {hasHistory && (
                  <Button size="xs" variant="light" color="blue" onClick={() => setShowHistory(!showHistory)}>
                    {showHistory ? 'Hide History' : 'View Full History'}
                  </Button>
                )}
              </Group>
              <Table withTableBorder withColumnBorders bg="white" className="dark:bg-[#25262b]">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Poka Yoke Item</Table.Th>
                    <Table.Th>Checking Method</Table.Th>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Correction Action</Table.Th>
                    <Table.Th>Admin Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {displayDetails.map((detail: any) => (
                    <Table.Tr key={detail.id}>
                      <Table.Td>{detail.pokaYokeItem?.pokaYokeName || 'Unknown Item'}</Table.Td>
                      <Table.Td>{detail.pokaYokeItem?.checkingMethod || 'N/A'}</Table.Td>
                      <Table.Td>{detail.observedValue}</Table.Td>
                      <Table.Td>
                        <Badge size="sm" color={detail.status === 'PASS' ? 'green' : 'red'}>
                          {detail.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{detail.correctionAction || '-'}</Table.Td>
                      <Table.Td>
                        {detail.status === 'FAIL' && !hasPassDetail(detail.pokaYokeItemId) && (
                          <Text size="xs" c="red" fw={500}>Needs Fix</Text>
                        )}
                        {detail.status === 'PASS' && hasHistory && txn.details.some((d: any) => d.pokaYokeItemId === detail.pokaYokeItemId && d.status === 'FAIL') ? (
                          <Text size="xs" c="green" fw={500}>Corrected</Text>
                        ) : detail.status === 'PASS' ? (
                          <Text size="xs" c="dimmed">-</Text>
                        ) : null}
                        {detail.status === 'FAIL' && hasPassDetail(detail.pokaYokeItemId) && (
                          <Text size="xs" c="dimmed">Fixed</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Box>
          </Collapse>
        </Table.Td>
      </Table.Tr>

      <Modal opened={takingAction} onClose={() => setTakingAction(false)} title="Take Action — Correct Failed Parameters" size="lg">
        <Paper bg="red.0" p="md" radius="md" mb="xl">
          <Group mb="xs">
            <Badge color="red" variant="filled">REJECTED</Badge>
            <Text fw={600} size="lg">{txn.part?.partNumber}</Text>
          </Group>
          <Text size="sm" c="dimmed">
            {txn.shiftId ? `Shift ${txn.shiftId}` : 'No Shift'} — {format(new Date(txn.date), 'M/d/yyyy')}
          </Text>
        </Paper>

        <Text fw={600} mb="sm">Failed Parameters (editable):</Text>
        <Table withTableBorder withColumnBorders mb="xl">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Parameter</Table.Th>
              <Table.Th>Checking Method</Table.Th>
              <Table.Th>Original Value</Table.Th>
              <Table.Th>Corrected Value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {failedItems.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.pokaYokeItem?.pokaYokeName}</Table.Td>
                <Table.Td>{item.pokaYokeItem?.checkingMethod}</Table.Td>
                <Table.Td><Badge color="red" variant="light">{item.observedValue}</Badge></Table.Td>
                <Table.Td>
                  {item.pokaYokeItem?.readingType === 'text' ? (
                    <TextInput
                      placeholder="Text value"
                      value={corrections[item.pokaYokeItemId] || ''}
                      onChange={(e) => setCorrections(prev => ({ ...prev, [item.pokaYokeItemId]: e.target.value }))}
                    />
                  ) : item.pokaYokeItem?.readingType === 'ok_ng' ? (
                    <Button 
                      size="xs" 
                      variant={corrections[item.pokaYokeItemId] === 'OK' ? 'filled' : 'light'} 
                      color="green"
                      onClick={() => setCorrections(prev => ({ ...prev, [item.pokaYokeItemId]: 'OK' }))}
                    >
                      OK
                    </Button>
                  ) : (
                    <Group gap="xs" wrap="nowrap">
                      <TextInput
                        placeholder="Value"
                        value={
                          corrections[item.pokaYokeItemId] !== undefined 
                            ? corrections[item.pokaYokeItemId].split(' ')[0] 
                            : ''
                        }
                        onChange={(e) => {
                          const parts = corrections[item.pokaYokeItemId]?.split(' ') || [];
                          const unit = parts.slice(1).join(' ');
                          setCorrections(prev => ({ ...prev, [item.pokaYokeItemId]: unit ? `${e.target.value} ${unit}` : e.target.value }));
                        }}
                        style={{ flex: 1, minWidth: 100 }}
                      />
                      <Autocomplete
                        data={commonUnits}
                        placeholder="Unit"
                        value={
                          corrections[item.pokaYokeItemId] !== undefined 
                            ? corrections[item.pokaYokeItemId].split(' ').slice(1).join(' ') 
                            : ''
                        }
                        onChange={(unit) => {
                          const val = corrections[item.pokaYokeItemId]?.split(' ')[0] || '';
                          setCorrections(prev => ({ ...prev, [item.pokaYokeItemId]: unit ? `${val} ${unit}` : val }));
                        }}
                        style={{ width: 80 }}
                      />
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Text fw={600} mb="xs">Correction Remarks</Text>
        <Textarea
          placeholder="Reason for correction (optional)..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          mb="xl"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setTakingAction(false)}>Cancel</Button>
          <Button color="orange" leftSection={<Wrench size={16} />} onClick={handleCorrectionSubmit} loading={addCorrectionMutation.isPending} disabled={Object.values(corrections).every(v => !v.trim())}>Submit Corrections</Button>
        </Group>
      </Modal>
    </>
  );
}

export function PokaYokeReports() {
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Default to last 7 days
  const defaultEnd = new Date();
  const defaultStart = new Date();
  defaultStart.setDate(defaultEnd.getDate() - 6);
  
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([defaultStart, defaultEnd]);
  const [activeTab, setActiveTab] = useState<string | null>('individual');
  const [selectedTxns, setSelectedTxns] = useState<string[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: reportRef.current.scrollWidth });
      const imgData = canvas.toDataURL('image/png');
      
      // A4 landscape dimensions in mm
      const a4Width = 297;
      const a4Height = 210;
      const margin = 5;
      const contentWidth = a4Width - margin * 2;
      const contentHeight = a4Height - margin * 2;
      
      const imgAspect = canvas.width / canvas.height;
      let drawWidth = contentWidth;
      let drawHeight = contentWidth / imgAspect;
      
      // If image is taller than page, scale down
      if (drawHeight > contentHeight) {
        drawHeight = contentHeight;
        drawWidth = contentHeight * imgAspect;
      }
      
      const pdf = new jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4'
      });
      
      pdf.addImage(imgData, 'PNG', margin, margin, drawWidth, drawHeight);
      pdf.save(`Pokayoke_Report.pdf`);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to generate PDF.', color: 'red' });
    } finally {
      setIsDownloading(false);
    }
  };

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
  });

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
  });

  const tpl = {
    companyName: settings.report_company_name || 'SUNDRAM FASTENERS LTD., (AUTOLEC DIVISION PLANT-II) GUMMIDIPOONDI-601201',
    title: settings.report_title || 'POKA-YOKE INSPECTION REPORT',
    rNo: settings.report_r_no || '03',
    rDate: settings.report_r_date || '23.04.2023',
    docNumber: settings.report_doc_number || 'TAF/P2/9.4',
    logo: settings.report_logo || null,
  };

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['pokayoke-report', selectedPart, dateRange[0]?.toISOString(), dateRange[1]?.toISOString()],
    queryFn: async () => {
      if (!selectedPart || !dateRange[0] || !dateRange[1]) return null;
      const { data } = await api.get('/pokayoke/report', {
        params: {
          partId: selectedPart,
          startDate: dateRange[0].toISOString(),
          endDate: dateRange[1].toISOString(),
        }
      });
      return data; // { items, transactions }
    },
    enabled: !!selectedPart && !!dateRange[0] && !!dateRange[1],
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/pokayoke/transaction/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Approved',
        message: 'Poka Yoke transaction has been approved successfully.',
        color: 'green',
        icon: <Check size={16} />,
      });
      queryClient.invalidateQueries({ queryKey: ['pokayoke-report'] });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to approve transaction.',
        color: 'red',
        icon: <X size={16} />,
      });
    },
  });

  const addCorrectionMutation = useMutation({
    mutationFn: async (data: { transactionId: string, corrections: any[], remarks: string }) => {
      await api.post(`/pokayoke/transaction/${data.transactionId}/corrections`, data);
    },
    onSuccess: () => {
      notifications.show({ title: 'Corrections Submitted', message: 'Corrections have been saved successfully.', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['pokayoke-report'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/pokayoke/transaction/${id}`);
    },
    onSuccess: () => {
      notifications.show({ title: 'Deleted', message: 'Transaction deleted successfully.', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['pokayoke-report'] });
      setSelectedTxns([]);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await api.post(`/pokayoke/transaction/bulk-delete`, { ids });
    },
    onSuccess: () => {
      notifications.show({ title: 'Deleted', message: 'Transactions deleted successfully.', color: 'green' });
      queryClient.invalidateQueries({ queryKey: ['pokayoke-report'] });
      setSelectedTxns([]);
    },
  });

  const toggleSelectAll = () => {
    if (!reportData?.transactions) return;
    if (selectedTxns.length === reportData.transactions.length) {
      setSelectedTxns([]);
    } else {
      setSelectedTxns(reportData.transactions.map((t: any) => t.id));
    }
  };

  // Generate date columns for Daily Check Sheet
  const getDateColumns = () => {
    if (!dateRange[0] || !dateRange[1]) return [];
    const cols = [];
    let current = new Date(dateRange[0]);
    current.setHours(0, 0, 0, 0);
    const end = new Date(dateRange[1]);
    end.setHours(23, 59, 59, 999);
    
    while (current <= end) {
      cols.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return cols;
  };

  const dateColumns = getDateColumns();

  // Helper to find reading for a specific item and date
  const getReading = (itemId: string, date: Date) => {
    if (!reportData?.transactions) return null;
    
    // Format target date in local timezone YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;
    
    // Iterate backwards to get the latest reading for the day
    for (let i = reportData.transactions.length - 1; i >= 0; i--) {
      const txn = reportData.transactions[i];
      const txnDate = new Date(txn.date);
      const txnY = txnDate.getFullYear();
      const txnM = String(txnDate.getMonth() + 1).padStart(2, '0');
      const txnD = String(txnDate.getDate()).padStart(2, '0');
      const txnDateStr = `${txnY}-${txnM}-${txnD}`;

      if (txnDateStr === targetDateStr) {
        const itemDetails = txn.details.filter((d: any) => d.pokaYokeItemId === itemId);
        if (itemDetails.length > 0) {
          const passDetail = itemDetails.find((d: any) => d.status === 'PASS');
          return passDetail || itemDetails[0];
        }
      }
    }
    return null;
  };

  const getTransactionForDate = (date: Date) => {
    if (!reportData?.transactions) return null;
    // Iterate backwards to get the latest entry for the day
    for (let i = reportData.transactions.length - 1; i >= 0; i--) {
      const txn = reportData.transactions[i];
      const txnDate = new Date(txn.date);
      if (
        txnDate.getFullYear() === date.getFullYear() &&
        txnDate.getMonth() === date.getMonth() &&
        txnDate.getDate() === date.getDate()
      ) {
        return txn;
      }
    }
    return null;
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Poka Yoke Reports</Title>
      </Group>

      <Paper withBorder p="md" radius="md" mb="xl">
        <Group mb="xl">
          <Select
            label="Select Part"
            placeholder="Search and select part"
            data={parts.map((p: any) => ({ value: p.id, label: `${p.partNumber} - ${p.partName}` }))}
            value={selectedPart}
            onChange={setSelectedPart}
            searchable
            required
            style={{ width: 300 }}
          />
          <DatePickerInput
            type="range"
            label="Date Range"
            placeholder="Pick dates range"
            value={dateRange}
            onChange={setDateRange}
            style={{ width: 300 }}
          />
        </Group>

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="individual" leftSection={<LayoutList size={16} />}>
              Individual Submissions
            </Tabs.Tab>
            <Tabs.Tab value="daily" leftSection={<FileText size={16} />}>
              Daily Audit Check Sheet
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="individual">
            {selectedPart && dateRange[0] && dateRange[1] ? (
              isLoading ? (
                <Center p="xl"><Loader /></Center>
              ) : reportData?.transactions?.length > 0 ? (
                <div>
                  {selectedTxns.length > 0 && (
                    <Group mb="md">
                      <Text size="sm" fw={500}>{selectedTxns.length} items selected</Text>
                      <Button
                        color="red"
                        variant="light"
                        leftSection={<Trash2 size={16} />}
                        onClick={() => {
                          modals.openConfirmModal({
                            title: 'Delete Multiple Transactions',
                            children: <Text size="sm">Are you sure you want to delete {selectedTxns.length} submissions? This action cannot be undone.</Text>,
                            labels: { confirm: 'Delete All', cancel: 'Cancel' },
                            confirmProps: { color: 'red' },
                            onConfirm: () => bulkDeleteMutation.mutate(selectedTxns),
                          });
                        }}
                        loading={bulkDeleteMutation.isPending}
                      >
                        Delete Selected
                      </Button>
                    </Group>
                  )}
                  <div className="overflow-x-auto">
                    <Table striped highlightOnHover withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th style={{ width: 40 }}>
                            <Checkbox 
                              checked={selectedTxns.length > 0 && selectedTxns.length === reportData.transactions.length}
                              indeterminate={selectedTxns.length > 0 && selectedTxns.length < reportData.transactions.length}
                              onChange={toggleSelectAll}
                            />
                          </Table.Th>
                          <Table.Th style={{ width: 40 }}></Table.Th>
                          <Table.Th>Date & Time</Table.Th>
                          <Table.Th>Part / Operation</Table.Th>
                          <Table.Th>Shift</Table.Th>
                          <Table.Th>Inspector</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Actions</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {reportData.transactions.map((txn: any) => (
                          <TransactionRow 
                            key={txn.id} 
                            txn={{ ...txn, part: parts.find((p: any) => p.id === txn.partId) }} 
                            approveMutation={approveMutation}
                            deleteMutation={deleteMutation}
                            isSelected={selectedTxns.includes(txn.id)}
                            onToggleSelect={() => {
                              setSelectedTxns(prev => 
                                prev.includes(txn.id) ? prev.filter(id => id !== txn.id) : [...prev, txn.id]
                              );
                            }}
                            addCorrectionMutation={addCorrectionMutation}
                          />
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                </div>
              ) : (
                <Text c="dimmed" ta="center" p="xl">No submissions found for the selected filters.</Text>
              )
            ) : (
              <Text c="dimmed" ta="center" p="xl">Please select a part and date range to view reports.</Text>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="daily">
            {selectedPart && dateRange[0] && dateRange[1] ? (
              isLoading ? (
                <Center p="xl"><Loader /></Center>
              ) : reportData?.items?.length > 0 ? (
                <div>
                  <Group justify="flex-end" mb="md">
                    <Button leftSection={<Download size={16} />} loading={isDownloading} onClick={handleDownloadPdf}>
                      Download PDF
                    </Button>
                  </Group>
                  <div className="overflow-x-auto">
                    <div ref={reportRef} className="bg-white p-2" style={{ minWidth: 800, maxWidth: 1123, width: '100%' }}>
                      <Table striped highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead className="bg-white dark:bg-[#1f2025]">
                      <Table.Tr>
                        <Table.Th 
                          colSpan={1} 
                          style={{ backgroundColor: '#204080', color: 'white', textAlign: 'center', padding: '8px 10px', verticalAlign: 'middle' }}
                        >
                          {tpl.logo ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50, maxHeight: 60, width: '100%' }}>
                              <img 
                                src={tpl.logo} 
                                alt="Report Logo" 
                                style={{ maxHeight: '52px', maxWidth: '120px', objectFit: 'contain' }} 
                              />
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', border: '2px solid white', borderRadius: '50%', width: 50, height: 50, alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                              <Text fw={900} size="lg" style={{ fontStyle: 'italic', letterSpacing: '-1px' }}>TVS</Text>
                            </div>
                          )}
                        </Table.Th>
                        <Table.Th colSpan={4 + dateColumns.length} style={{ padding: '12px' }}>
                          <Text fw={800} size="sm">{tpl.companyName}</Text>
                          <Text fw={700} size="sm" mt={4}>{tpl.title}</Text>
                          <Text fw={700} size="sm" mt={4} style={{ textTransform: 'uppercase' }}>
                            PART NUMBER : {parts.find((p: any) => p.id === selectedPart)?.partNumber} {parts.find((p: any) => p.id === selectedPart)?.partName}
                          </Text>
                        </Table.Th>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Th rowSpan={2} style={{ width: 50 }}>SI.No</Table.Th>
                        <Table.Th rowSpan={2}>Operation</Table.Th>
                        <Table.Th rowSpan={2}>POKA-YOKE</Table.Th>
                        <Table.Th rowSpan={2}>Checking Method</Table.Th>
                        <Table.Th rowSpan={2}>Frequency</Table.Th>
                        <Table.Th colSpan={dateColumns.length} style={{ textAlign: 'center' }}>Date</Table.Th>
                      </Table.Tr>
                      <Table.Tr>
                        {dateColumns.map((d, i) => (
                          <Table.Th key={i} style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '4px 6px', fontSize: '11px' }}>
                            {String(d.getDate()).padStart(2, '0')}
                          </Table.Th>
                        ))}
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {reportData.items.map((item: any, idx: number) => (
                        <Table.Tr key={item.id}>
                          <Table.Td fw={500} style={{ padding: '4px 6px', fontSize: '11px' }}>{idx + 1}</Table.Td>
                          <Table.Td style={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 120, padding: '4px 6px', fontSize: '11px' }}>{item.operation}</Table.Td>
                          <Table.Td style={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 150, padding: '4px 6px', fontSize: '11px' }}>{item.pokaYokeName}</Table.Td>
                          <Table.Td style={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 120, padding: '4px 6px', fontSize: '11px' }}>{item.checkingMethod || '-'}</Table.Td>
                          <Table.Td style={{ padding: '4px 6px', fontSize: '11px' }}>
                            <Text size="xs">{item.frequency || 'N/A'}</Text>
                          </Table.Td>
                          {dateColumns.map((d, i) => {
                            const reading = getReading(item.id, d);
                            return (
                              <Table.Td key={i} style={{ textAlign: 'center', padding: '4px 6px' }}>
                                {reading ? (
                                  <Group gap={4} justify="center" wrap="nowrap">
                                    {reading.status === 'PASS' ? (
                                      <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">
                                        <Check size={14} />
                                      </div>
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center">
                                        <X size={14} />
                                      </div>
                                    )}
                                  </Group>
                                ) : (
                                  <Text c="dimmed">-</Text>
                                )}
                              </Table.Td>
                            );
                          })}
                        </Table.Tr>
                      ))}
                      {/* Overall Status Section */}
                      <Table.Tr>
                        <Table.Td colSpan={5} fw={700} ta="right" pr="xl">Overall Status (OK / NOT OK)</Table.Td>
                        {dateColumns.map((d, i) => {
                          const txn = getTransactionForDate(d);
                          return (
                            <Table.Td key={i} style={{ textAlign: 'center' }}>
                              {txn ? (
                                <Text fw={700} size="sm" c={txn.status === 'PASSED' || txn.status === 'APPROVED' ? 'green' : 'red'}>
                                  {txn.status === 'PASSED' || txn.status === 'APPROVED' ? 'OK' : 'NOT OK'}
                                </Text>
                              ) : (
                                <Text c="dimmed">-</Text>
                              )}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>

                      {/* Signature Section */}
                      <Table.Tr>
                        <Table.Td colSpan={3} fw={700} style={{ borderBottom: 'none', paddingBottom: 4 }}>R.No : {tpl.rNo}</Table.Td>
                        <Table.Td colSpan={2} fw={700}>INSPECTED BY</Table.Td>
                        {dateColumns.map((d, i) => {
                          const txn = getTransactionForDate(d);
                          return (
                            <Table.Td key={i} style={{ textAlign: 'center' }}>
                               {txn?.inspector?.signature ? (
                                 <img src={txn.inspector.signature} alt={txn.inspector.name} className="h-8 object-contain mx-auto" />
                               ) : txn?.inspector?.name ? (
                                 <Text size="sm" fw={500}>{txn.inspector.name}</Text>
                               ) : (
                                 <Text c="dimmed">-</Text>
                               )}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td colSpan={3} fw={700} style={{ borderTop: 'none', paddingTop: 0 }}>R.Date : {tpl.rDate}</Table.Td>
                        <Table.Td colSpan={2} fw={700}>APPROVED BY</Table.Td>
                        {dateColumns.map((d, i) => {
                          const txn = getTransactionForDate(d);
                          return (
                            <Table.Td key={i} style={{ textAlign: 'center' }}>
                               {txn?.adminUser?.signature ? (
                                 <img src={txn.adminUser.signature} alt={txn.adminUser.name} className="h-8 object-contain mx-auto" />
                               ) : txn?.adminUser?.name ? (
                                 <Text size="sm" c="green" fw={500}>{txn.adminUser.name}</Text>
                               ) : (
                                 <Text c="dimmed">-</Text>
                               )}
                            </Table.Td>
                          );
                        })}
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                  <Text size="xs" fw={600} mt="xs" mb="xs">{tpl.docNumber}</Text>
                </div>
              </div>
            </div>
              ) : (
                <Text c="dimmed" ta="center" p="xl">No data available for the selected filters.</Text>
              )
            ) : (
              <Text c="dimmed" ta="center" p="xl">Please select a part and date range to view reports.</Text>
            )}
          </Tabs.Panel>
        </Tabs>
      </Paper>
    </div>
  );
}
