import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Paper, Title, Group, Select, TextInput, Button, 
  Table, Badge, Textarea, Affix, Transition, Text, Autocomplete, SimpleGrid
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { Check, Save, X, AlertTriangle } from 'lucide-react';
import { masterDataService } from '../services/master-data.service';
import { inspectionService } from '../services/inspection.service';
import { CheckCircle2, XCircle } from 'lucide-react';

export function InspectionEntry() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryPart = searchParams.get('partId');
  const queryOp = searchParams.get('opId');

  const [selectedPart, setSelectedPart] = useState<string | null>(queryPart);
  const [selectedOp, setSelectedOp] = useState<string | null>(queryOp);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (queryPart) setSelectedPart(queryPart);
    if (queryOp) setSelectedOp(queryOp);
  }, [queryPart, queryOp]);

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

  const { data: parameters = [] } = useQuery({
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

  // Calculate PASS/FAIL status for a parameter
  const getStatus = (param: typeof parameters[0]): 'PASS' | 'FAIL' | null => {
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
        lotNumber: values.lotNumber,
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

  const statuses = parameters.map(p => getStatus(p));
  const allPassed = statuses.length > 0 && statuses.every(s => s === 'PASS');
  const anyFailed = statuses.some(s => s === 'FAIL');
  const totalReadingsEntered = Object.values(form.values.readings).filter(v => v !== undefined && v !== null && String(v).trim() !== '').length;
  const isDuplicate = todayTransactions.some(
    (t) => t.shiftId === form.values.shiftId && t.intervalName === form.values.intervalName
  );

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
            data={shifts.map(s => ({ value: s.id, label: s.name }))}
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
            data={['1 Half', '2 Half', 'First Piece', 'Last Piece']}
            disabled={!selectedPart || !selectedOp}
            {...form.getInputProps('intervalName')}
          />
          <TextInput
            label="Lot Number"
            placeholder="e.g. L-1234"
            required
            disabled={!selectedPart || !selectedOp}
            {...form.getInputProps('lotNumber')}
          />
        </SimpleGrid>
      </Paper>

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

      {parameters.length > 0 && (
        <Paper withBorder p={0} radius="md" className="overflow-hidden">
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
                {parameters.map((param) => {
                  const status = getStatus(param);
                  const count = getReadingCount(param.freqOfInspn, form.values.intervalName);
                  return (
                    <Table.Tr key={param.id}>
                      <Table.Td className="font-medium">
                        <div>{param.parameterName}</div>
                        <div className="text-xs text-gray-500 font-normal">Freq: {param.freqOfInspn || 'N/A'}</div>
                      </Table.Td>
                      <Table.Td>{param.specText || `${param.nominalValue} +${param.upperTolerance}/${param.lowerTolerance}`}</Table.Td>
                      <Table.Td>{param.methodOfChecking}</Table.Td>
                      <Table.Td style={{ minWidth: 220 }}>
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
      )}

      {/* Sticky Save Button Bar */}
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
                    disabled={!form.values.lotNumber || totalReadingsEntered === 0 || isDuplicate}
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
    </div>
  );
}

