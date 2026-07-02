import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Paper, Title, Group, Select, TextInput, Button, 
  Table, Badge, Textarea, Affix, Transition, Text, Autocomplete, SimpleGrid,
  Progress, Card, SegmentedControl, Alert
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useForm } from '@mantine/form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Check, Save, X, AlertTriangle, Info, Filter, SkipForward } from 'lucide-react';
import { masterDataService } from '../services/master-data.service';
import { inspectionService } from '../services/inspection.service';
import { settingsService } from '../services/settings.service';
import { CheckCircle2, XCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { TableSkeleton } from '../components/TableSkeleton';

export function InspectionEntry() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPart = searchParams.get('partId');
  const queryOp = searchParams.get('opId');

  const [selectedPart, setSelectedPart] = useState<string | null>(queryPart);
  const [selectedOp, setSelectedOp] = useState<string | null>(queryOp);
  const [submitting, setSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [mobileViewMode, setMobileViewMode] = useState<string>('single');
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const isMobile = useMediaQuery('(max-width: 768px)');

  useEffect(() => {
    if (queryPart) setSelectedPart(queryPart);
    if (queryOp) setSelectedOp(queryOp);
  }, [queryPart, queryOp]);

  // Fetch settings (Feature 1: lot number)
  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
  });

  const lotNumberRequired = settings.lot_number_required !== 'false';

  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ['drafts'],
    queryFn: inspectionService.getDrafts
  });

  const saveDraftMutation = useMutation({
    mutationFn: (values: any) => inspectionService.saveDraft({
      partId: selectedPart,
      operationId: selectedOp,
      ...values,
    }),
    onSuccess: () => {
      notifications.show({
        title: 'Draft Saved',
        message: 'Your progress has been saved to the database.',
        color: 'blue'
      });
      refetchDrafts();
    }
  });

  // Load draft when part/operation is selected and drafts are fetched
  useEffect(() => {
    if (selectedPart && selectedOp) {
      const draft = drafts.find((d: any) => d.partId === selectedPart && d.operationId === selectedOp);
      if (draft) {
        try {
          const parsedReadings = JSON.parse(draft.readingsData || '{}');
          form.setValues({
            shiftId: draft.shiftId || '',
            mcNo: draft.mcNo || '',
            lotNumber: draft.lotNumber || '',
            intervalName: draft.intervalName || '1 Half',
            remarks: draft.remarks || '',
            readings: parsedReadings
          });
          notifications.show({
            title: 'Draft Loaded',
            message: 'Continuing from your previously saved draft.',
            color: 'blue',
            icon: <Check size={16} />
          });
        } catch (e) {
          form.reset();
        }
      } else {
        form.reset();
      }
    }
  }, [selectedPart, selectedOp, drafts]);

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts
  });

  const { data: operations = [] } = useQuery({
    queryKey: ['operations', selectedPart],
    queryFn: () => masterDataService.getOperationsByPart(selectedPart!),
    enabled: !!selectedPart
  });

  const { data: parameters = [], isLoading: isParamsLoading } = useQuery({
    queryKey: ['parameters', selectedPart, selectedOp],
    queryFn: () => masterDataService.getParameters(selectedPart!, selectedOp!),
    enabled: !!selectedPart && !!selectedOp
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: masterDataService.getShifts
  });

  const { data: todayTransactions = [], refetch: refetchTodayTransactions } = useQuery({
    queryKey: ['today-transactions', selectedPart, selectedOp],
    queryFn: () => inspectionService.getDailyReport({
      partId: selectedPart!,
      operationId: selectedOp!,
      date: new Date().toISOString().split('T')[0]
    }),
    enabled: !!selectedPart && !!selectedOp
  });

  // Feature 6: Derive unique method-of-checking values for filter
  const uniqueMethods = useMemo(() => {
    const methods = parameters
      .map(p => p.methodOfChecking)
      .filter((m): m is string => !!m && m.trim() !== '');
    return [...new Set(methods)].sort();
  }, [parameters]);

  // Feature 6: Apply method filter
  const filteredParameters = useMemo(() => {
    if (!methodFilter) return parameters;
    return parameters.filter(p => p.methodOfChecking === methodFilter);
  }, [parameters, methodFilter]);

  // Feature 3: Day-wise frequency check helper
  const isDayWiseAlreadyRecorded = (param: typeof parameters[0]): boolean => {
    if (param.frequencyUnit !== 'day') return false;
    const freq = String(param.freqOfInspn || '').toLowerCase().trim();
    const isFreq1 = freq === '1' || freq === '1no/shift' || freq === '1/shift' || freq === '1/day' || freq === 'once per shift';
    if (!isFreq1) return false;
    // Check if any shift today already has a reading for this param
    return todayTransactions.some(tx =>
      tx.details?.some(d => d.parameterId === param.id)
    );
  };

  const getReadingCount = (freq: string | null | undefined, interval: string): number => {
    if (!freq) return 1;
    const lowerFreq = freq.toLowerCase().trim();
    
    if (interval === 'First Piece' || interval === 'Last Piece') {
      return 1;
    }
    
    if (lowerFreq.includes('4nos') || lowerFreq.startsWith('4')) {
      return 2;
    }
    
    if (lowerFreq.includes('2nos') || lowerFreq.startsWith('2')) {
      return 1;
    }
    
    if (lowerFreq.includes('1no') || lowerFreq.startsWith('1')) {
      return 1;
    }
    
    return 1;
  };

  const form = useForm({
    initialValues: {
      shiftId: '',
      mcNo: '',
      lotNumber: '',
      intervalName: '1 Half',
      remarks: '',
      readings: {} as Record<string, string>,
    }
  });

  // Feature 4: Auto-advance interval when shift is selected
  useEffect(() => {
    if (form.values.shiftId && todayTransactions.length > 0) {
      const has1Half = todayTransactions.some(
        t => t.shiftId === form.values.shiftId && t.intervalName === '1 Half'
      );
      const has2Half = todayTransactions.some(
        t => t.shiftId === form.values.shiftId && t.intervalName === '2 Half'
      );
      
      if (has1Half && !has2Half) {
        form.setFieldValue('intervalName', '2 Half');
      }
    }
  }, [form.values.shiftId, todayTransactions]);

  // Calculate PASS/FAIL status for a parameter
  const getStatus = (param: typeof parameters[0]): 'PASS' | 'FAIL' | null => {
    // If day-wise and already recorded, treat as PASS
    if (isDayWiseAlreadyRecorded(param)) return 'PASS';

    const count = getReadingCount(param.freqOfInspn, form.values.intervalName);
    
    let hasReadings = false;
    let anyFailed = false;
    let allFilled = true;

    for (let idx = 0; idx < count; idx++) {
      const val = form.values.readings[`${param.id}_${idx}`];
      if (val !== undefined && val !== null && val.trim() !== '') {
        hasReadings = true;
        
        if (param.controlLimitMin !== null && param.controlLimitMax !== null) {
          const numVal = parseFloat(val);
          if (isNaN(numVal)) {
            anyFailed = true;
          } else {
            const EPSILON = 1e-6;
            if (numVal < param.controlLimitMin - EPSILON || numVal > param.controlLimitMax + EPSILON) {
              anyFailed = true;
            }
          }
        } else {
          const lower = val.toLowerCase().trim();
          if (lower === 'ng' || lower === 'fail') {
            anyFailed = true;
          } else if (/\\b(ng|fail|reject|rejected|not ok)\\b/.test(lower)) {
            anyFailed = true;
          }
        }
      } else {
        allFilled = false;
      }
    }

    if (anyFailed) return 'FAIL';
    if (allFilled && hasReadings) return 'PASS';
    return null;
  };

  const handleSubmit = async (values: typeof form.values) => {
    if (!selectedPart || !selectedOp) return;

    // Feature 1: Validate lot number based on setting
    if (lotNumberRequired && (!values.lotNumber || values.lotNumber.trim() === '')) {
      notifications.show({
        title: 'Lot Number Required',
        message: 'Please enter a Lot Number. You can make it optional in Settings.',
        color: 'orange',
        icon: <AlertTriangle size={16} />
      });
      return;
    }

    // Duplicate submission check
    const isDuplicate = todayTransactions.some(
      (t) => t.shiftId === values.shiftId && t.intervalName === values.intervalName
    );
    if (isDuplicate) {
      notifications.show({
        title: 'Duplicate Submission Blocked',
        message: 'An inspection has already been saved for this Shift and Interval today.',
        color: 'orange',
        icon: <AlertTriangle size={16} />
      });
      return;
    }

    setSubmitting(true);
    try {
      const details: { parameterId: string; observedValue: string }[] = [];

      for (const param of parameters) {
        // Feature 3: Skip day-wise already-recorded params
        if (isDayWiseAlreadyRecorded(param)) continue;

        const count = getReadingCount(param.freqOfInspn, values.intervalName);
        for (let idx = 0; idx < count; idx++) {
          const val = values.readings[`${param.id}_${idx}`];
          if (val === undefined || val === null || val.trim() === '') {
            notifications.show({
              title: 'Incomplete Readings',
              message: `Please enter all readings for: ${param.parameterName}`,
              color: 'orange',
            });
            return;
          }

          // LC precision validation
          if (param.leastCount && param.leastCount > 0) {
            const maxDecimals = Math.round(-Math.log10(param.leastCount));
            const parts = val.trim().split('.');
            if (parts.length === 2 && parts[1].length > maxDecimals) {
              notifications.show({
                title: 'Precision Error',
                message: `"${param.parameterName}" reading must not exceed ${maxDecimals} decimal places (LC: ${param.leastCount})`,
                color: 'orange',
              });
              setSubmitting(false);
              return;
            }
          }

          details.push({
            parameterId: param.id,
            observedValue: val.trim(),
          });
        }
      }

      await inspectionService.submitInspection({
        shiftId: values.shiftId,
        mcNo: values.mcNo,
        partId: selectedPart,
        operationId: selectedOp,
        lotNumber: values.lotNumber || undefined,
        intervalName: values.intervalName,
        remarks: values.remarks,
        details,
      });

      notifications.show({
        title: 'Success',
        message: 'Inspection submitted successfully',
        color: 'green',
        icon: <Check size={16} />
      });
      
      refetchTodayTransactions();
      refetchDrafts();
      setSelectedPart(null);
      setSelectedOp(null);
      setSearchParams({});
      form.reset();
      
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to submit inspection',
        color: 'red',
        icon: <X size={16} />
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Use all parameters for status calculation, but filteredParameters for display
  const statuses = parameters.map(p => getStatus(p));
  const allPassed = statuses.length > 0 && statuses.every(s => s === 'PASS');
  const anyFailed = statuses.some(s => s === 'FAIL');
  const completedParamsCount = statuses.filter(s => s !== null).length;
  const completionPercentage = parameters.length > 0 ? Math.round((completedParamsCount / parameters.length) * 100) : 0;
  const totalReadingsEntered = Object.values(form.values.readings).filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;
  const isDuplicate = todayTransactions.some(
    (t) => t.shiftId === form.values.shiftId && t.intervalName === form.values.intervalName
  );

  // Feature 2: Find first pending parameter index (in filtered list) for mobile "Jump to Pending"
  const firstPendingIndex = useMemo(() => {
    for (let i = 0; i < filteredParameters.length; i++) {
      if (getStatus(filteredParameters[i]) === null) return i;
    }
    return -1;
  }, [filteredParameters, form.values.readings, form.values.intervalName]);

  // Feature 4: Check if 1st half is already done for selected shift
  const is1HalfDone = form.values.shiftId
    ? todayTransactions.some(t => t.shiftId === form.values.shiftId && t.intervalName === '1 Half')
    : false;

  // Lot number disable condition (updated for Feature 1)
  const submitDisabled = (lotNumberRequired && !form.values.lotNumber) || totalReadingsEntered === 0 || isDuplicate;

  return (
    <div className="pb-24">
      <Title order={2} mb="lg">Inspection Entry</Title>

      <Paper withBorder p="md" radius="md" mb="xl">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }} spacing="md">
          <Select
            label="Part Number"
            data={parts.map(p => ({ value: p.id, label: p.partNumber }))}
            value={selectedPart}
            onChange={(val) => {
              setSelectedPart(val);
              setSelectedOp(null);
              setActiveStep(0);
              setMethodFilter(null);
              setSearchParams(val ? { partId: val } : {});
            }}
            placeholder="Select Part Number"
            searchable
          />
          <Select
            label="Operation"
            data={operations.map(o => ({ value: o.id, label: o.operationNumber }))}
            value={selectedOp}
            onChange={(val) => {
              setSelectedOp(val);
              setActiveStep(0);
              setMethodFilter(null);
              if (selectedPart) {
                setSearchParams({ partId: selectedPart, opId: val || '' });
              }
            }}
            disabled={!selectedPart}
            placeholder="Select Operation"
            searchable
          />
          <Select
            label="Shift"
            data={shifts.map(s => {
              const shiftHas1Half = todayTransactions.some(t => t.shiftId === s.id && t.intervalName === '1 Half');
              const shiftHas2Half = todayTransactions.some(t => t.shiftId === s.id && t.intervalName === '2 Half');
              const isCompleted = shiftHas1Half && shiftHas2Half;
              
              return { 
                value: s.id, 
                label: isCompleted ? `${s.name} (Completed)` : s.name,
                disabled: isCompleted
              };
            })}
            required
            disabled={!selectedPart || !selectedOp}
            {...form.getInputProps('shiftId')}
          />
          <TextInput
            label="M/C No"
            placeholder="Machine Number"
            required
            disabled={!selectedPart || !selectedOp}
            {...form.getInputProps('mcNo')}
          />
          <Select
            label="Interval"
            data={[
              { value: '1 Half', label: '1 Half', disabled: is1HalfDone },
              { value: '2 Half', label: '2 Half' },
              { value: 'First Piece', label: 'First Piece' },
              { value: 'Last Piece', label: 'Last Piece' }
            ]}
            disabled={!selectedPart || !selectedOp}
            {...form.getInputProps('intervalName')}
          />
          <TextInput
            label={`Lot Number${lotNumberRequired ? '' : ' (Optional)'}`}
            placeholder="e.g. L-1234"
            required={lotNumberRequired}
            disabled={!selectedPart || !selectedOp}
            {...form.getInputProps('lotNumber')}
          />
        </SimpleGrid>
      </Paper>

      {/* Feature 4: Auto-advance info banner */}
      {is1HalfDone && form.values.intervalName === '2 Half' && (
        <Alert
          icon={<Info size={16} />}
          title="1st Half Already Completed"
          color="blue"
          variant="light"
          mb="md"
        >
          The 1st Half inspection has already been submitted for this shift. You are now entering the 2nd Half.
        </Alert>
      )}

      {selectedPart && selectedOp && (
        <Paper withBorder p="md" radius="md" mb="xl" className="bg-blue-50/20 border-blue-200">
          <Group justify="space-between" align="flex-start" className="flex-col sm:flex-row">
            <div className="mb-2 sm:mb-0">
              <Text size="sm" fw={700} c="blue.8">Today's Inspection Completion Status</Text>
              <Text size="xs" c="dimmed">Completed vs pending shifts and intervals for today</Text>
            </div>
            <Group gap="xs" className="w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              {['Shift A', 'Shift B', 'Shift C'].map(shiftName => {
                const has1Half = todayTransactions.some(t => t.shift?.name === shiftName && t.intervalName === '1 Half');
                const has2Half = todayTransactions.some(t => t.shift?.name === shiftName && t.intervalName === '2 Half');
                
                let color = 'gray';
                let statusText = 'Pending';
                if (has1Half && has2Half) {
                  color = 'green';
                  statusText = 'Completed';
                } else if (has1Half || has2Half) {
                  color = 'orange';
                  statusText = `${has1Half ? '1st Half' : '2nd Half'} Saved`;
                }

                return (
                  <Paper key={shiftName} withBorder px="sm" py="xs" radius="sm" className="bg-white">
                    <Group gap="xs">
                      <Text size="xs" fw={700} c="gray.7">{shiftName}:</Text>
                      <Badge color={color} size="sm" variant="light">
                        {statusText}
                      </Badge>
                    </Group>
                  </Paper>
                );
              })}
            </Group>
          </Group>
        </Paper>
      )}

      {/* Feature 6: Method of Checking Filter */}
      {parameters.length > 0 && uniqueMethods.length > 1 && (
        <Paper withBorder p="sm" radius="md" mb="md" className="bg-gray-50">
          <Group gap="sm" align="center">
            <Select
              label="Filter by Method of Checking"
              placeholder="All Methods"
              data={uniqueMethods.map(m => ({ value: m, label: m }))}
              value={methodFilter}
              onChange={(val) => {
                setMethodFilter(val);
                setActiveStep(0);
              }}
              clearable
              size="sm"
              leftSection={<Filter size={16} className="text-gray-500" />}
              style={{ minWidth: 250 }}
            />
            {methodFilter && (
              <Badge color="blue" variant="light" size="lg" mt={24}>
                Showing {filteredParameters.length} of {parameters.length} parameters
              </Badge>
            )}
          </Group>
        </Paper>
      )}

      {isParamsLoading ? (
        <Paper withBorder p="md" radius="md">
           <TableSkeleton rows={4} />
        </Paper>
      ) : filteredParameters.length > 0 && (
        <>
          {/* Desktop Table View */}
          <Paper withBorder p={0} radius="md" className="hidden md:block overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <Table striped highlightOnHover verticalSpacing="md" style={{ minWidth: 800 }}>
              <Table.Thead className="bg-gray-50">
                <Table.Tr>
                  <Table.Th>Parameter</Table.Th>
                  <Table.Th>Specification</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th style={{ minWidth: 200 }}>Reading</Table.Th>
                  <Table.Th style={{ minWidth: 120 }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filteredParameters.map((param) => {
                  const status = getStatus(param);
                  const count = getReadingCount(param.freqOfInspn, form.values.intervalName);
                  const dayWiseRecorded = isDayWiseAlreadyRecorded(param);
                  return (
                    <Table.Tr key={param.id} className={dayWiseRecorded ? 'opacity-60' : ''}>
                      <Table.Td className="font-medium">
                        <div>{param.parameterName}</div>
                        <div className="text-xs text-gray-500 font-normal">Freq: {param.freqOfInspn || 'N/A'}</div>
                        {dayWiseRecorded && (
                          <Badge color="teal" size="xs" variant="light" mt={2}>Already recorded today</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>{param.specText || `${param.nominalValue} +${param.upperTolerance}/${param.lowerTolerance}`}</Table.Td>
                      <Table.Td>{param.methodOfChecking}</Table.Td>
                      <Table.Td style={{ minWidth: 220 }}>
                        {dayWiseRecorded ? (
                          <Text size="sm" c="dimmed" fs="italic">Recorded in earlier shift</Text>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {Array.from({ length: count }).map((_, idx) => {
                              const isNumeric = param.controlLimitMin !== null || param.controlLimitMax !== null;
                              // Calculate allowed decimal places from LC
                              const lc = param.leastCount;
                              const decimalPlaces = lc && lc > 0 ? Math.round(-Math.log10(lc)) : undefined;
                              const stepVal = lc && lc > 0 ? String(lc) : '0.001';

                              const validateLcPrecision = (value: string) => {
                                if (!lc || lc <= 0 || !decimalPlaces) return;
                                const parts = value.split('.');
                                if (parts.length === 2 && parts[1].length > decimalPlaces) {
                                  // Truncate to allowed decimal places
                                  const truncated = parseFloat(value).toFixed(decimalPlaces);
                                  form.setFieldValue(`readings.${param.id}_${idx}`, truncated);
                                }
                              };

                              return isNumeric ? (
                                <div key={idx}>
                                  <TextInput
                                    placeholder={`Reading ${idx + 1}`}
                                    type="number"
                                    inputMode="decimal"
                                    step={stepVal}
                                    size="sm"
                                    {...form.getInputProps(`readings.${param.id}_${idx}`)}
                                    onBlur={(e) => {
                                      validateLcPrecision(e.target.value);
                                    }}
                                  />
                                  {lc && (
                                    <Text size="xs" c="dimmed" mt={2}>LC: {lc}</Text>
                                  )}
                                </div>
                              ) : (
                                <Autocomplete
                                  key={idx}
                                  placeholder="Select or type OK/NG"
                                  data={['OK', 'NG']}
                                  size="sm"
                                  {...form.getInputProps(`readings.${param.id}_${idx}`)}
                                />
                              );
                            })}
                          </div>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {status === 'PASS' && (
                          <Badge color="green" size="lg" className="w-full" variant="filled">PASS</Badge>
                        )}
                        {status === 'FAIL' && (
                          <Badge color="red" size="lg" className="w-full" variant="filled">FAIL</Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
          
          <div className="p-4 border-t">
            <Textarea
              label="Remarks"
              placeholder="Any issues or notes..."
              {...form.getInputProps('remarks')}
            />
          </div>
        </Paper>

        {/* Mobile View — Feature 2: List/Single toggle */}
        <div className="block md:hidden mb-8">
          {/* View Mode Toggle */}
          <Group justify="space-between" mb="md">
            <SegmentedControl
              value={mobileViewMode}
              onChange={setMobileViewMode}
              data={[
                { label: 'Single Item', value: 'single' },
                { label: 'List View', value: 'list' },
              ]}
              size="sm"
            />
            <Text size="sm" fw={500} c="blue">{completionPercentage}% done</Text>
          </Group>

          {mobileViewMode === 'list' ? (
            /* Mobile List View */
            <Paper withBorder radius="md" p={0} className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table striped highlightOnHover verticalSpacing="sm" style={{ minWidth: 500 }}>
                  <Table.Thead className="bg-gray-50">
                    <Table.Tr>
                      <Table.Th style={{ width: 40 }}>#</Table.Th>
                      <Table.Th>Parameter</Table.Th>
                      <Table.Th>Spec</Table.Th>
                      <Table.Th style={{ minWidth: 140 }}>Reading</Table.Th>
                      <Table.Th style={{ width: 60 }}>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredParameters.map((param, idx) => {
                      const status = getStatus(param);
                      const count = getReadingCount(param.freqOfInspn, form.values.intervalName);
                      const isNumeric = param.controlLimitMin !== null || param.controlLimitMax !== null;
                      const dayWiseRecorded = isDayWiseAlreadyRecorded(param);
                      const lc = param.leastCount;
                      const decimalPlaces = lc && lc > 0 ? Math.round(-Math.log10(lc)) : undefined;
                      const stepVal = lc && lc > 0 ? String(lc) : '0.001';

                      return (
                        <Table.Tr key={param.id} className={dayWiseRecorded ? 'opacity-60' : ''}>
                          <Table.Td className="text-center text-xs font-semibold">{idx + 1}</Table.Td>
                          <Table.Td>
                            <Text size="xs" fw={600} lineClamp={1}>{param.parameterName}</Text>
                            <Text size="xs" c="dimmed">{param.methodOfChecking}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" lineClamp={1}>{param.specText || '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            {dayWiseRecorded ? (
                              <Text size="xs" c="dimmed" fs="italic">Done</Text>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {Array.from({ length: count }).map((_, readIdx) => (
                                  isNumeric ? (
                                    <TextInput
                                      key={readIdx}
                                      placeholder={`R${readIdx + 1}`}
                                      type="number"
                                      inputMode="decimal"
                                      step={stepVal}
                                      size="xs"
                                      {...form.getInputProps(`readings.${param.id}_${readIdx}`)}
                                      onBlur={(e) => {
                                        if (!lc || lc <= 0 || !decimalPlaces) return;
                                        const parts = e.target.value.split('.');
                                        if (parts.length === 2 && parts[1].length > decimalPlaces) {
                                          const truncated = parseFloat(e.target.value).toFixed(decimalPlaces);
                                          form.setFieldValue(`readings.${param.id}_${readIdx}`, truncated);
                                        }
                                      }}
                                    />
                                  ) : (
                                    <Autocomplete
                                      key={readIdx}
                                      placeholder="OK/NG"
                                      data={['OK', 'NG']}
                                      size="xs"
                                      {...form.getInputProps(`readings.${param.id}_${readIdx}`)}
                                    />
                                  )
                                ))}
                              </div>
                            )}
                          </Table.Td>
                          <Table.Td className="text-center">
                            {status === 'PASS' && <Badge color="green" size="xs" variant="filled">OK</Badge>}
                            {status === 'FAIL' && <Badge color="red" size="xs" variant="filled">NG</Badge>}
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </div>

              <div className="p-3 border-t">
                <Textarea
                  label="Remarks"
                  placeholder="Any issues or notes..."
                  size="sm"
                  {...form.getInputProps('remarks')}
                />
              </div>

              <div className="p-3 border-t flex gap-2">
                <Button
                  variant="default"
                  leftSection={<Save size={16} />}
                  onClick={() => saveDraftMutation.mutate(form.values)}
                  loading={saveDraftMutation.isPending}
                  className="flex-1"
                  size="sm"
                >
                  Save Draft
                </Button>
                <Button
                  onClick={() => handleSubmit(form.values)}
                  loading={submitting}
                  disabled={submitDisabled}
                  color={anyFailed ? 'red' : allPassed ? 'green' : 'blue'}
                  className="flex-1"
                  size="sm"
                >
                  Submit
                </Button>
              </div>
            </Paper>
          ) : (
            /* Mobile Single Item (Wizard) View */
            <>
              <div className="mb-4">
                <Group justify="space-between" mb="xs">
                  <Select
                    size="xs"
                    variant="filled"
                    value={String(activeStep)}
                    onChange={(val) => val && setActiveStep(Number(val))}
                    data={filteredParameters.map((_, idx) => ({ value: String(idx), label: `Parameter ${idx + 1} of ${filteredParameters.length}` }))}
                    styles={{ input: { fontWeight: 600, width: 140 } }}
                    allowDeselect={false}
                  />
                  {/* Feature 2: Jump to Pending button */}
                  {firstPendingIndex >= 0 && firstPendingIndex !== activeStep && (
                    <Button
                      variant="light"
                      color="orange"
                      size="xs"
                      leftSection={<SkipForward size={14} />}
                      onClick={() => setActiveStep(firstPendingIndex)}
                    >
                      Jump to Pending
                    </Button>
                  )}
                </Group>
                <Progress value={completionPercentage} size="md" color="blue" radius="xl" />
              </div>

              <Card withBorder shadow="sm" radius="md" p="md">
                {(() => {
                  const param = filteredParameters[activeStep];
                  if (!param) return null;
                  const status = getStatus(param);
                  const count = getReadingCount(param.freqOfInspn, form.values.intervalName);
                  const isNumeric = param.controlLimitMin !== null || param.controlLimitMax !== null;
                  const lc = param.leastCount;
                  const decimalPlaces = lc && lc > 0 ? Math.round(-Math.log10(lc)) : undefined;
                  const stepVal = lc && lc > 0 ? String(lc) : '0.001';
                  const dayWiseRecorded = isDayWiseAlreadyRecorded(param);

                  const validateLcPrecision = (value: string, idx: number) => {
                    if (!lc || lc <= 0 || !decimalPlaces) return;
                    const parts = value.split('.');
                    if (parts.length === 2 && parts[1].length > decimalPlaces) {
                      const truncated = parseFloat(value).toFixed(decimalPlaces);
                      form.setFieldValue(`readings.${param.id}_${idx}`, truncated);
                    }
                  };

                  return (
                    <div>
                      <Group justify="space-between" align="flex-start" mb="md">
                        <div>
                          <Text fw={700} size="xl">{param.parameterName}</Text>
                          <Text size="sm" c="dimmed">Method: {param.methodOfChecking}</Text>
                          <Text size="sm" c="dimmed">Freq: {param.freqOfInspn || 'N/A'}</Text>
                        </div>
                        {status === 'PASS' && <Badge color="green" size="lg" variant="filled">PASS</Badge>}
                        {status === 'FAIL' && <Badge color="red" size="lg" variant="filled">FAIL</Badge>}
                      </Group>

                      <Paper withBorder bg="blue.0" p="md" radius="sm" mb="lg" className="border-blue-200">
                        <Text size="sm" fw={700} c="blue.9">Specification:</Text>
                        <Text size="lg" fw={600} c="blue.9">
                          {param.specText || `${param.nominalValue} +${param.upperTolerance}/${param.lowerTolerance}`}
                        </Text>
                      </Paper>

                      {dayWiseRecorded ? (
                        <Alert color="teal" variant="light" icon={<Info size={16} />}>
                          This parameter has already been recorded in an earlier shift today (Day-wise frequency).
                        </Alert>
                      ) : (
                        <div className="flex flex-col gap-4">
                          {Array.from({ length: count }).map((_, idx) => (
                            <div key={idx}>
                              <Text size="sm" fw={600} mb={6}>Reading {idx + 1}</Text>
                              {isNumeric ? (
                                <TextInput
                                  placeholder={`Enter reading ${idx + 1}`}
                                  type="number"
                                  inputMode="decimal"
                                  step={stepVal}
                                  size="xl"
                                  {...form.getInputProps(`readings.${param.id}_${idx}`)}
                                  onBlur={(e) => validateLcPrecision(e.target.value, idx)}
                                />
                              ) : (
                                <Autocomplete
                                  placeholder="Select OK/NG"
                                  data={['OK', 'NG']}
                                  size="xl"
                                  {...form.getInputProps(`readings.${param.id}_${idx}`)}
                                />
                              )}
                              {lc && <Text size="xs" c="dimmed" mt={4}>Least Count: {lc}</Text>}
                            </div>
                          ))}
                        </div>
                      )}

                      <Group justify="space-between" mt="xl" pt="md" className="border-t">
                        <Button
                          variant="light"
                          leftSection={<ArrowLeft size={16} />}
                          disabled={activeStep === 0}
                          onClick={() => setActiveStep(prev => prev - 1)}
                          size="md"
                        >
                          Back
                        </Button>
                        
                        {activeStep < filteredParameters.length - 1 ? (
                          <Button
                            rightSection={<ArrowRight size={16} />}
                            onClick={() => setActiveStep(prev => prev + 1)}
                            size="md"
                          >
                            Next
                          </Button>
                        ) : (
                          <Button
                            color={anyFailed ? 'red' : allPassed ? 'green' : 'blue'}
                            onClick={() => handleSubmit(form.values)}
                            loading={submitting}
                            disabled={submitDisabled}
                            leftSection={<CheckCircle2 size={16} />}
                            size="md"
                          >
                            Submit
                          </Button>
                        )}
                      </Group>
                      <Button
                        variant="default"
                        fullWidth
                        mt="md"
                        leftSection={<Save size={16} />}
                        onClick={() => saveDraftMutation.mutate(form.values)}
                        loading={saveDraftMutation.isPending}
                        size="md"
                      >
                        Save as Draft
                      </Button>
                    </div>
                  );
                })()}
              </Card>

              {activeStep === filteredParameters.length - 1 && (
                <Card withBorder shadow="sm" radius="md" p="md" mt="md">
                  <Textarea
                    label="Final Remarks"
                    placeholder="Any issues or notes before submitting..."
                    {...form.getInputProps('remarks')}
                    minRows={3}
                    size="md"
                  />
                </Card>
              )}
            </>
          )}
        </div>
      </>
      )}

      {/* Sticky Save Button Bar (Desktop Only) */}
      {!isMobile && (
        <Affix position={{ bottom: 0, left: 0, right: 0 }} zIndex={100}>
          <Transition transition="slide-up" mounted={parameters.length > 0}>
            {(transitionStyles) => (
              <div 
                style={transitionStyles} 
                className={`p-3 sm:p-4 shadow-lg border-t ${
                  anyFailed ? 'bg-red-50' : allPassed ? 'bg-green-50' : 'bg-white'
                }`}
              >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pl-[250px] max-md:pl-0 w-full max-w-7xl mx-auto">
                {isDuplicate ? (
                  <Group c="orange" className="font-bold text-sm sm:text-base">
                    <AlertTriangle size={20} /> DUPLICATE SAVED (Already saved for today)
                  </Group>
                ) : anyFailed ? (
                  <Group c="red" className="font-bold text-sm sm:text-base">
                    <XCircle size={20} /> STATUS: REJECTED
                  </Group>
                ) : allPassed ? (
                  <Group c="green" className="font-bold text-sm sm:text-base">
                    <CheckCircle2 size={20} /> STATUS: PASSED
                  </Group>
                ) : (
                  <Text c="dimmed" size="sm" className="hidden sm:block">Enter all readings to validate status...</Text>
                )}
                
                <div className="sm:ml-auto flex w-full sm:w-auto justify-between sm:justify-end gap-2 sm:gap-4">
                  <Button
                    variant="default"
                    leftSection={<Save size={16} />}
                    onClick={() => saveDraftMutation.mutate(form.values)}
                    loading={saveDraftMutation.isPending}
                    className="flex-1 sm:flex-none"
                    size="sm"
                  >
                    Save as Draft
                  </Button>
                  <Button
                    onClick={() => handleSubmit(form.values)}
                    loading={submitting}
                    disabled={submitDisabled}
                    color={anyFailed ? 'red' : allPassed ? 'green' : 'blue'}
                    className="flex-1 sm:flex-none"
                    size="sm"
                  >
                    Submit Inspection
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Transition>
      </Affix>
      )}
    </div>
  );
}

