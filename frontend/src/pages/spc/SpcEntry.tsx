import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Paper, Title, Group, Select, TextInput, Button, 
  Table, Badge, Textarea, Text, SimpleGrid,
  Progress
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Check, Save, Info, CheckCircle2, XCircle } from 'lucide-react';
import { masterDataService } from '../../services/master-data.service';
import { spcService } from '../../services/spc.service';
import { usersService } from '../../services/users.service';
import { TableSkeleton } from '../../components/TableSkeleton';
import { DatePickerInput } from '@mantine/dates';
import { useAuthStore } from '../../store/auth-store';

export function SpcEntry() {
  const [searchParams] = useSearchParams();
  const queryPartNumber = searchParams.get('partNumber') || searchParams.get('partId');
  const queryMcNo = searchParams.get('mcNo') || '';

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedPartNumber, setSelectedPartNumber] = useState<string | null>(queryPartNumber);
  const [selectedMachineNumber, setSelectedMachineNumber] = useState<string | null>(queryMcNo || null);
  const [entryDate, setEntryDate] = useState<Date | null>(new Date());
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuthStore();
  const [operatorId, setOperatorId] = useState<string>('');

  const isAdmin = user?.role === 'ADMIN';

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.getAll,
    enabled: isAdmin,
  });

  const inspectors = users.filter((u: any) => u.role === 'INSPECTOR');

  const currentMonth = entryDate ? entryDate.getMonth() + 1 : new Date().getMonth() + 1;
  const currentYear = entryDate ? entryDate.getFullYear() : new Date().getFullYear();

  const { data: monthlyStatus = {} } = useQuery({
    queryKey: ['spc-monthly-status', selectedPartNumber, selectedMachineNumber, currentMonth, currentYear],
    queryFn: () => spcService.getMonthlyStatus({
      partId: selectedPartNumber!,
      operationId: 'N/A', // Assuming SPC data uses partNumber primarily
      mcNo: selectedMachineNumber || '',
      month: currentMonth,
      year: currentYear
    }),
    enabled: !!selectedPartNumber && !!selectedMachineNumber && isAdmin
  });

  // Fetch configured SPC Characteristics
  const { data: characteristics = [], isLoading: loadingChars } = useQuery({
    queryKey: ['spc-characteristics', selectedPartNumber],
    queryFn: () => spcService.getCharacteristics({
      partNumber: selectedPartNumber || undefined,
    }),
    enabled: !!selectedPartNumber,
  });

  const { data: allCharacteristics = [] } = useQuery({
    queryKey: ['spc-characteristics-all'],
    queryFn: () => spcService.getCharacteristics(),
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const availablePartNumbers = useMemo(() => {
    if (!selectedCustomerId) {
      return Array.from(new Set(allCharacteristics.map((c: any) => c.partNumber)));
    }
    // Only return part numbers configured in SPC Master Data linked to selected Customer
    return Array.from(new Set(
      allCharacteristics
        .filter((c: any) => c.customerId === selectedCustomerId)
        .map((c: any) => c.partNumber)
    ));
  }, [allCharacteristics, selectedCustomerId]);

  const availableMachinesForCustomer = useMemo(() => {
    if (!selectedCustomerId) return [];
    const customerObj = customers.find((c: any) => c.id === selectedCustomerId);
    if (customerObj && customerObj.activeMachines && customerObj.activeMachines.length > 0) {
      return customerObj.activeMachines;
    }
    if (customerObj && customerObj.machines && customerObj.machines.length > 0) {
      return customerObj.machines;
    }
    return Array.from(new Set(
      allCharacteristics
        .filter((c: any) => c.customerId === selectedCustomerId || (selectedPartNumber && c.partNumber === selectedPartNumber))
        .map((c: any) => c.machineNumber)
        .filter(Boolean)
    ));
  }, [customers, allCharacteristics, selectedCustomerId, selectedPartNumber]);

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: masterDataService.getShifts,
  });

  const { data: duplicateCheck } = useQuery({
    queryKey: ['spc-check-duplicate', entryDate, selectedPartNumber, selectedMachineNumber],
    queryFn: () => spcService.checkDuplicate({
      date: entryDate ? entryDate.toISOString() : new Date().toISOString(),
      partNumber: selectedPartNumber!,
      machineNumber: selectedMachineNumber || undefined,
    }),
    enabled: !!entryDate && !!selectedPartNumber,
  });

  const isDuplicate = duplicateCheck?.isDuplicate || false;
  const duplicateMessage = duplicateCheck?.message || '';

  const { refetch: refetchDrafts } = useQuery({
    queryKey: ['spc-drafts'],
    queryFn: spcService.getDrafts,
  });

  const saveDraftMutation = useMutation({
    mutationFn: (values: any) => spcService.saveDraft({
      partId: selectedPartNumber,
      mcNo: selectedMachineNumber,
      ...values,
    }),
    onSuccess: () => {
      notifications.show({
        title: 'Draft Saved',
        message: 'SPC readings draft saved successfully',
        color: 'blue',
      });
      refetchDrafts();
    },
  });

  // Readings state: { [charId]: [x1, x2, x3, x4, x5] }
  const [subgroupReadings, setSubgroupReadings] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (characteristics.length > 0) {
      const initial: Record<string, string[]> = {};
      characteristics.forEach((c: any) => {
        initial[c.id] = subgroupReadings[c.id] || ['', '', '', '', ''];
      });
      setSubgroupReadings(initial);
    }
  }, [characteristics]);

  const handleReadingChange = (charId: string, index: number, value: string) => {
    setSubgroupReadings(prev => {
      const current = prev[charId] ? [...prev[charId]] : ['', '', '', '', ''];
      current[index] = value;
      return { ...prev, [charId]: current };
    });
  };

  const form = useForm({
    initialValues: {
      shiftId: '',
      lotNumber: '',
      intervalName: '1 Half',
      remarks: '',
    },
    validate: {
      shiftId: (val: string) => (!val ? 'Shift is required' : null),
    },
  });

  // Calculate Subgroup stats for each Characteristic
  const evaluateSubgroup = (char: any, readings: string[]) => {
    const numericReadings = readings.map(r => parseFloat(r)).filter(r => !isNaN(r));
    if (numericReadings.length === 0) return { mean: null, range: null, status: 'EMPTY' };

    const sum = numericReadings.reduce((a, b) => a + b, 0);
    const mean = sum / numericReadings.length;
    const max = Math.max(...numericReadings);
    const min = Math.min(...numericReadings);
    const range = max - min;

    let status: 'PASS' | 'FAIL' = 'PASS';
    if (char.usl !== null && char.usl !== undefined && numericReadings.some(v => v > char.usl)) {
      status = 'FAIL';
    }
    if (char.lsl !== null && char.lsl !== undefined && numericReadings.some(v => v < char.lsl)) {
      status = 'FAIL';
    }

    return { mean: mean.toFixed(4), range: range.toFixed(4), status };
  };

  const completedCount = useMemo(() => {
    return characteristics.filter((c: any) => {
      const r = subgroupReadings[c.id];
      return r && r.some(val => val.trim() !== '');
    }).length;
  }, [characteristics, subgroupReadings]);

  const progressPercent = characteristics.length > 0 ? (completedCount / characteristics.length) * 100 : 0;

  const handleSubmit = async (values: typeof form.values) => {
    if (!selectedPartNumber) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please select a Part Number',
        color: 'red',
      });
      return;
    }

    setSubmitting(true);
    try {
      await spcService.uploadSpcDataByPartNo(characteristics.map((char: any) => {
        const readings = subgroupReadings[char.id] || [];
        const numericValues = readings.map(r => parseFloat(r)).filter(r => !isNaN(r));
        return {
          partNumber: selectedPartNumber,
          parameterName: char.qualityCharacteristic,
          productDescription: char.productDescription || undefined,
          usl: char.usl,
          lsl: char.lsl,
          sampleValues: numericValues,
          batchLot: values.lotNumber || undefined,
          ...(isAdmin && entryDate ? { timestamp: entryDate.toISOString() } : {}),
        };
      }));

      notifications.show({
        title: 'Subgroup Entry Saved',
        message: `Successfully saved SPC subgroup entries for Part ${selectedPartNumber}!`,
        color: 'green',
        icon: <CheckCircle2 size={16} />
      });

      // Clear readings
      const cleared: Record<string, string[]> = {};
      characteristics.forEach((c: any) => { cleared[c.id] = ['', '', '', '', '']; });
      setSubgroupReadings(cleared);
      form.setFieldValue('remarks', '');
    } catch (err: any) {
      notifications.show({
        title: 'Submission Error',
        message: err?.response?.data?.message || 'Failed to submit SPC readings.',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="text-gray-900 dark:text-gray-100">
            Statistical Process Control (SPC) Entry
          </Title>
          <Text size="sm" c="dimmed">
            Record 5 sample readings per subgroup for Quality Characteristics
          </Text>
        </div>
        <Group>
          <Button
            variant="light"
            color="blue"
            leftSection={<Save size={16} />}
            onClick={() => saveDraftMutation.mutate(form.values)}
            disabled={!selectedPartNumber}
            loading={saveDraftMutation.isPending}
          >
            Save Draft
          </Button>
        </Group>
      </div>

      {/* Customer, Part & Machine Cascading Selection */}
      <Paper p="md" radius="lg" withBorder className="shadow-sm bg-white dark:bg-gray-800">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 6 }} spacing="md">
          <DatePickerInput
            label="Entry Date"
            placeholder="Select date"
            value={entryDate}
            onChange={setEntryDate}
            required
            renderDay={(date) => {
              if (!isAdmin) return <div>{date.getDate()}</div>;
              const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
              const status = monthlyStatus[dateStr];
              let bg = undefined;
              if (status === 'COMPLETE') bg = 'var(--mantine-color-green-filled)';
              if (status === 'MISSING') bg = 'var(--mantine-color-red-filled)';
              if (status === 'PARTIAL') bg = 'var(--mantine-color-orange-filled)';
              return (
                <div style={{ backgroundColor: bg, color: bg ? 'white' : undefined, borderRadius: '4px', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {date.getDate()}
                </div>
              );
            }}
          />
          {isAdmin && (
            <Select
              label="Operator Name"
              placeholder="Select Operator"
              data={inspectors.map((u: any) => ({ value: u.id, label: u.name }))}
              value={operatorId}
              onChange={(val) => setOperatorId(val || '')}
              searchable
              clearable
            />
          )}

          <Select
            label="Customer"
            placeholder="Select Customer"
            searchable
            data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
            value={selectedCustomerId}
            onChange={(val: string | null) => {
              setSelectedCustomerId(val);
              setSelectedPartNumber(null);
              setSelectedMachineNumber(null);
            }}
          />

          <Select
            label="Part Number"
            placeholder="Select Part Number"
            searchable
            data={availablePartNumbers.map((p: any) => ({ value: p, label: p }))}
            value={selectedPartNumber}
            onChange={(val: string | null) => {
              setSelectedPartNumber(val);
              setSelectedMachineNumber(null);
            }}
            disabled={!selectedCustomerId}
          />

          <Select
            label="Machine Number"
            placeholder="Select Machine"
            data={availableMachinesForCustomer.map((m: any) => ({ value: m, label: m }))}
            value={selectedMachineNumber}
            onChange={setSelectedMachineNumber}
            disabled={!selectedPartNumber}
            clearable
          />

          <Select
            label="Shift"
            placeholder="Select Shift"
            data={shifts.map((s: any) => ({ value: s.id, label: s.name }))}
            {...form.getInputProps('shiftId')}
          />

          <TextInput
            label="Lot / Batch Number"
            placeholder="e.g. BATCH-2026"
            {...form.getInputProps('lotNumber')}
          />
        </SimpleGrid>
      </Paper>

      {/* Subgroup Entry Form (5 Readings per Characteristic) */}
      {selectedCustomerId && selectedPartNumber && selectedMachineNumber ? (
        loadingChars ? (
          <TableSkeleton rows={5} />
        ) : characteristics.length === 0 ? (
          <Paper p="xl" radius="md" withBorder className="text-center">
            <Text c="dimmed">No SPC Quality Characteristics found for Part Number '{selectedPartNumber}'. Please add them in SPC Master Data.</Text>
          </Paper>
        ) : (
          <Paper p="md" radius="lg" withBorder className="shadow-sm bg-white dark:bg-gray-800 space-y-4">
            {isDuplicate && (
              <Paper p="md" radius="md" withBorder className="bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 flex items-center gap-3">
                <XCircle size={24} className="text-red-600 flex-shrink-0" />
                <div>
                  <Text fw={700} size="sm">Duplicate SPC Report Alert!</Text>
                  <Text size="xs">{duplicateMessage}</Text>
                </div>
              </Paper>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <Title order={4}>Subgroup Measurements (5 Readings Default)</Title>
                <Text size="xs" c="dimmed">
                  Completed {completedCount} of {characteristics.length} Characteristics ({Math.round(progressPercent)}%)
                </Text>
              </div>
              <Progress value={progressPercent} color={progressPercent === 100 ? 'green' : 'blue'} size="sm" className="w-full sm:w-48" />
            </div>

            <form onSubmit={form.onSubmit(handleSubmit)}>
              <div className="overflow-x-auto">
                <Table striped highlightOnHover verticalSpacing="sm">
                  <Table.Thead className="bg-gray-50 dark:bg-[#25262b]">
                    <Table.Tr>
                      <Table.Th style={{ width: 40 }}>#</Table.Th>
                      <Table.Th>Quality Characteristic</Table.Th>
                      <Table.Th>USL / LSL</Table.Th>
                      <Table.Th style={{ minWidth: 400 }}>Subgroup Sample Readings (X1 - X5)</Table.Th>
                      <Table.Th style={{ width: 90 }}>Subgroup Mean</Table.Th>
                      <Table.Th style={{ width: 80 }}>Range (R)</Table.Th>
                      <Table.Th style={{ width: 90 }}>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {characteristics.map((char: any, idx: number) => {
                      const readings = subgroupReadings[char.id] || ['', '', '', '', ''];
                      const stats = evaluateSubgroup(char, readings);

                      return (
                        <Table.Tr key={char.id}>
                          <Table.Td>{idx + 1}</Table.Td>
                          <Table.Td>
                            <Text fw={600} size="sm">{char.qualityCharacteristic}</Text>
                            {char.productDescription && <Text size="xs" c="dimmed">{char.productDescription}</Text>}
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" fw={600}>
                              USL: <span className="text-green-600">{char.usl ?? '-'}</span><br/>
                              LSL: <span className="text-red-600">{char.lsl ?? '-'}</span>
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Group gap={6} wrap="nowrap">
                              {[0, 1, 2, 3, 4].map(readIdx => (
                                <TextInput
                                  key={readIdx}
                                  placeholder={`X${readIdx + 1}`}
                                  size="xs"
                                  value={readings[readIdx] || ''}
                                  onChange={(e) => handleReadingChange(char.id, readIdx, e.target.value)}
                                  className="w-16 text-center"
                                />
                              ))}
                            </Group>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" fw={700} className="text-blue-600">{stats.mean ?? '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" fw={600}>{stats.range ?? '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            {stats.status === 'PASS' && <Badge color="green" size="sm" leftSection={<CheckCircle2 size={10} />}>PASS</Badge>}
                            {stats.status === 'FAIL' && <Badge color="red" size="sm" leftSection={<XCircle size={10} />}>FAIL</Badge>}
                            {stats.status === 'EMPTY' && <Badge color="gray" variant="light" size="sm">EMPTY</Badge>}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </div>

              <Textarea
                label="Remarks / Notes"
                placeholder="Enter process observations or remarks..."
                mt="md"
                {...form.getInputProps('remarks')}
              />

              <Group justify="end" mt="xl">
                <Button
                  type="submit"
                  size="md"
                  color="blue"
                  loading={submitting}
                  disabled={isDuplicate}
                  leftSection={<Check size={18} />}
                >
                  {isDuplicate ? 'Duplicate Report Already Exists' : 'Submit SPC Subgroup Entry'}
                </Button>
              </Group>
            </form>
          </Paper>
        )
      ) : (
        <Paper p="xl" radius="lg" withBorder className="text-center py-16 bg-white dark:bg-gray-800">
          <Info size={48} className="mx-auto text-blue-500 mb-4 opacity-50" />
          <Title order={3} className="text-gray-700 dark:text-gray-300">
            {!selectedCustomerId ? 'Select Customer First' : !selectedPartNumber ? 'Select Part Number' : 'Select Machine Number'}
          </Title>
          <Text c="dimmed" mt="xs">
            {!selectedCustomerId 
              ? 'Please select a Customer above to load associated Part Numbers.' 
              : !selectedPartNumber 
              ? 'Please select a Part Number to load available Machine Numbers.' 
              : 'Please select a Machine Number to show the SPC subgroup entry screen.'}
          </Text>
        </Paper>
      )}
    </div>
  );
}
