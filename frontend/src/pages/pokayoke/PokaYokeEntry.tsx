import { useState, useEffect } from 'react';
import { Title, Paper, Group, Text, Button, Select, Table, Badge, TextInput, Autocomplete } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { Save, Check, X } from 'lucide-react';
import api from '../../lib/axios';
import { masterDataService } from '../../services/master-data.service';

import { useSearchParams } from 'react-router-dom';

import { useAuthStore } from '../../store/auth-store';

export function PokaYokeEntry() {
  const [searchParams] = useSearchParams();
  const queryPart = searchParams.get('partId');
  const { user } = useAuthStore();
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(queryPart);
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [readings, setReadings] = useState<Record<string, { value: string, status: 'PASS' | 'FAIL', correctionAction?: string }>>({});

  // Common units for the select
  const commonUnits = ['mm', 'kg', '°C', 'bar', 'MPa', 'V', 'A', 'sec', 'min', 'hrs', 'pcs'];

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
  });

  const userCustomerId = user?.customerId || selectedCustomer;
  const displayParts = userCustomerId
    ? parts.filter((p: any) => p.customerId === userCustomerId)
    : [];

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['pokayoke-items', selectedPart],
    queryFn: async () => {
      if (!selectedPart) return [];
      const { data } = await api.get(`/pokayoke/items?partId=${selectedPart}`);
      return data;
    },
    enabled: !!selectedPart,
  });

  const { data: draftData } = useQuery({
    queryKey: ['pokayoke-draft', selectedPart],
    queryFn: async () => {
      if (!selectedPart) return null;
      const { data } = await api.get(`/pokayoke/drafts?partId=${selectedPart}`);
      return data;
    },
    enabled: !!selectedPart,
  });

  const { data: transactionCheck, isLoading: isChecking } = useQuery({
    queryKey: ['pokayoke-check', selectedPart, selectedDate?.toISOString()],
    queryFn: async () => {
      if (!selectedPart || !selectedDate) return { exists: false };
      const { data } = await api.get(`/pokayoke/transaction/check?partId=${selectedPart}&date=${selectedDate.toISOString()}`);
      return data;
    },
    enabled: !!selectedPart && !!selectedDate,
  });

  // Load draft when available
  useEffect(() => {
    if (draftData && draftData.readingsData) {
      try {
        const parsed = JSON.parse(draftData.readingsData);
        // Map from array to record
        const draftReadings: any = {};
        parsed.forEach((r: any) => {
          draftReadings[r.itemId] = { value: r.value, status: r.status, correctionAction: r.correctionAction };
        });
        setReadings(draftReadings);
        if (draftData.date) {
          setSelectedDate(new Date(draftData.date));
        }
        notifications.show({ title: 'Draft Loaded', message: 'Restored from previous draft.', color: 'blue' });
      } catch (e) {
        console.error('Failed to parse draft', e);
      }
    } else if (!draftData && selectedPart) {
      setReadings({});
      setSelectedDate(new Date());
    }
  }, [draftData, selectedPart]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart || !selectedDate) throw new Error("Missing required fields");
      const readingsArray = Object.entries(readings).map(([itemId, data]) => ({
        itemId,
        value: data.value,
        status: data.status,
        correctionAction: data.correctionAction,
      }));
      const payload = {
        partId: selectedPart,
        date: selectedDate.toISOString(),
        readings: readingsArray,
      };
      const { data } = await api.post('/pokayoke/transaction', payload);
      return data;
    },
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: 'Poka Yoke readings saved successfully.',
        color: 'green',
        icon: <Check size={16} />,
      });
      setReadings({});
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'Failed to save readings.',
        color: 'red',
        icon: <X size={16} />,
      });
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPart || !selectedDate) throw new Error("Missing required fields");
      const readingsArray = Object.entries(readings).map(([itemId, data]) => ({
        itemId,
        value: data.value,
        status: data.status,
        correctionAction: data.correctionAction,
      }));
      const payload = {
        partId: selectedPart,
        date: selectedDate.toISOString(),
        readings: readingsArray,
      };
      const { data } = await api.post('/pokayoke/drafts', payload);
      return data;
    },
    onSuccess: () => {
      notifications.show({ title: 'Draft Saved', message: 'Your progress has been saved as a draft.', color: 'blue' });
    },
    onError: () => {
      notifications.show({ title: 'Draft Error', message: 'Failed to save draft.', color: 'red' });
    },
  });

  const handleStatusChange = (itemId: string, status: 'PASS' | 'FAIL') => {
    setReadings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status, value: prev[itemId]?.value || status }
    }));
  };

  const handleValueChange = (itemId: string, value: string) => {
    setReadings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], value, status: prev[itemId]?.status || 'PASS' }
    }));
  };

  const isComplete = items.length > 0 && items.every((item: any) => {
    const r = readings[item.id];
    if (!r?.status) return false;
    return true;
  });

  const handleSubmit = () => {
    const hasFailedItems = items.some((item: any) => readings[item.id]?.status === 'FAIL');
    
    if (hasFailedItems) {
      modals.openConfirmModal({
        title: 'Confirm Submission',
        centered: true,
        children: (
          <Text size="sm">
            One or more items have failed (NG). Are you sure you want to submit these readings?
          </Text>
        ),
        labels: { confirm: 'Yes, submit with failures', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: () => submitMutation.mutate(),
      });
    } else {
      submitMutation.mutate();
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Poka Yoke Entry</Title>
      </Group>

      <Paper withBorder p="md" radius="md" mb="xl">
        <Group align="flex-end" mb="xl">
          {!user?.customerId && (
            <Select
              label="Customer"
              placeholder="Select Customer"
              data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
              value={selectedCustomer}
              onChange={(val) => {
                setSelectedCustomer(val);
                setSelectedPart(null);
              }}
              searchable
              style={{ width: 250 }}
            />
          )}
          <Select
            label="Select Part"
            placeholder="Search and select part"
            data={displayParts.map((p: any) => ({ value: p.id, label: `${p.partNumber} - ${p.partName}` }))}
            value={selectedPart}
            onChange={setSelectedPart}
            disabled={!userCustomerId}
            searchable
            required
            style={{ width: 300 }}
          />
          <DatePickerInput
            label="Date"
            placeholder="Select date"
            value={selectedDate}
            onChange={setSelectedDate}
            required
            style={{ width: 200 }}
          />
        </Group>

        {selectedPart && (
          <>
            {isChecking ? (
              <Text>Checking status...</Text>
            ) : transactionCheck?.exists ? (
              <Paper withBorder p="xl" radius="md" bg="green.0">
                <Group justify="center" mb="md">
                  <Check size={48} color="green" />
                </Group>
                <Title order={3} ta="center" c="green.9" mb="sm">Already Completed!</Title>
                <Text ta="center" c="green.8">
                  A Poka-Yoke entry for this part on the selected date has already been submitted successfully.
                </Text>
              </Paper>
            ) : isLoading ? (
              <Text>Loading items...</Text>
            ) : items.length === 0 ? (
              <Text c="dimmed">No Poka Yoke items found for this part. Please upload master data.</Text>
            ) : (
              <div className="overflow-x-auto">
                <Table striped highlightOnHover withTableBorder withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Operation</Table.Th>
                      <Table.Th>Poka-Yoke Item</Table.Th>
                      <Table.Th>Checking Method</Table.Th>
                      <Table.Th>Frequency</Table.Th>
                      <Table.Th>Reading Value</Table.Th>
                      <Table.Th>Status (OK/NG)</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {items.map((item: any) => (
                      <Table.Tr key={item.id}>
                        <Table.Td fw={500}>{item.operation}</Table.Td>
                        <Table.Td>{item.pokaYokeName}</Table.Td>
                        <Table.Td>{item.checkingMethod || '-'}</Table.Td>
                        <Table.Td>
                          <Badge variant="light">{item.frequency || 'N/A'}</Badge>
                        </Table.Td>
                        <Table.Td>
                          {item.readingType === 'text' ? (
                            <TextInput
                              placeholder="Enter text..."
                              value={readings[item.id]?.value || ''}
                              onChange={(e) => handleValueChange(item.id, e.target.value)}
                              style={{ width: '100%' }}
                            />
                          ) : item.readingType === 'ok_ng' ? (
                            <Text size="sm" c="dimmed" ta="center">N/A</Text>
                          ) : (
                            <Group gap="xs" wrap="nowrap">
                              <TextInput
                                placeholder="Value"
                                value={
                                  readings[item.id]?.value !== undefined 
                                    ? readings[item.id].value.split(' ')[0] 
                                    : ''
                                }
                                onChange={(e) => {
                                  const parts = readings[item.id]?.value?.split(' ') || [];
                                  const unit = parts.slice(1).join(' ');
                                  handleValueChange(item.id, unit ? `${e.target.value} ${unit}` : e.target.value);
                                }}
                                style={{ flex: 1, minWidth: 100 }}
                              />
                              <Autocomplete
                                data={commonUnits}
                                placeholder="Unit"
                                value={
                                  readings[item.id]?.value !== undefined 
                                    ? readings[item.id].value.split(' ').slice(1).join(' ') 
                                    : ''
                                }
                                onChange={(unit) => {
                                  const val = readings[item.id]?.value?.split(' ')[0] || '';
                                  handleValueChange(item.id, unit ? `${val} ${unit}` : val);
                                }}
                                style={{ width: 80 }}
                              />
                            </Group>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs" mb={readings[item.id]?.status === 'FAIL' ? 'xs' : 0}>
                            <Button
                              size="xs"
                              variant={readings[item.id]?.status === 'PASS' ? 'filled' : 'light'}
                              color="green"
                              onClick={() => handleStatusChange(item.id, 'PASS')}
                            >
                              OK
                            </Button>
                            <Button
                              size="xs"
                              variant={readings[item.id]?.status === 'FAIL' ? 'filled' : 'light'}
                              color="red"
                              onClick={() => handleStatusChange(item.id, 'FAIL')}
                            >
                              NG
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                <Group justify="flex-end" mt="xl">
                  <Button
                    size="md"
                    variant="default"
                    leftSection={<Save size={18} />}
                    onClick={() => saveDraftMutation.mutate()}
                    loading={saveDraftMutation.isPending}
                  >
                    Save as Draft
                  </Button>
                  <Button
                    size="md"
                    leftSection={<Check size={18} />}
                    onClick={handleSubmit}
                    loading={submitMutation.isPending}
                    disabled={!isComplete}
                  >
                    Submit Readings
                  </Button>
                </Group>
              </div>
            )}
          </>
        )}
      </Paper>
    </div>
  );
}
