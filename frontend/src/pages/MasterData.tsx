import { useState } from 'react';
import {
  Title, Paper, Table, Group, TextInput, Text, Badge,
  ActionIcon, Tooltip, Collapse, Modal, Button,
  NumberInput, Tabs, Select
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, ChevronDown, ChevronRight, Trash2, Edit,
  Save, X, Plus, Database, UploadCloud
} from 'lucide-react';
import { masterDataService } from '../services/master-data.service';
import { notifications } from '@mantine/notifications';
import { PartWithOperations, InspectionParameter } from '../types';
import { ExcelUpload } from './ExcelUpload';
import { PokaYokeExcelUpload } from './pokayoke/PokaYokeExcelUpload';
import { TableSkeleton } from '../components/TableSkeleton';
import { modals } from '@mantine/modals';
import { useAuthStore } from '../store/auth-store';

export function MasterData() {
  const { appMode } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('parts');

  // Edit modal states
  const [editPart, setEditPart] = useState<{ partId: string; operationId: string; opNum: string } | null>(null);
  const [editPartModal, setEditPartModal] = useState<PartWithOperations | null>(null);
  const [editOpModal, setEditOpModal] = useState<{ id: string, operationNumber: string, operationName: string } | null>(null);
  const [editPokaYokeModal, setEditPokaYokeModal] = useState<any | null>(null);
  const [editPokaYokePart, setEditPokaYokePart] = useState<{ partId: string; partNumber: string; items: any[] } | null>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['parts-with-operations'],
    queryFn: masterDataService.getPartsWithOperations,
  });

  const deletePartMutation = useMutation({
    mutationFn: masterDataService.deletePart,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      notifications.show({ title: 'Deleted', message: data.message, color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Cannot Delete',
        message: err?.response?.data?.message || 'Failed to delete part.',
        color: 'red',
      });
    },
  });

  const deleteOpMutation = useMutation({
    mutationFn: ({ partId, operationId }: { partId: string; operationId: string }) =>
      masterDataService.deletePartOperation(partId, operationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Deleted', message: data.message, color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Cannot Delete',
        message: err?.response?.data?.message || 'Failed to delete operation.',
        color: 'red',
      });
    },
  });

  const toggleExpand = (partId: string) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(partId)) next.delete(partId);
      else next.add(partId);
      return next;
    });
  };

  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: { partNumber: string; partName: string; customerId?: string | null } }) =>
      masterDataService.updatePart(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Updated', message: 'Part updated successfully.', color: 'green' });
      setEditPartModal(null);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to update part.',
        color: 'red',
      });
    },
  });

  const updateOpMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: { operationNumber: string; operationName: string } }) =>
      masterDataService.updateOperation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Updated', message: 'Operation updated successfully.', color: 'green' });
      setEditOpModal(null);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to update operation.',
        color: 'red',
      });
    },
  });

  const updatePokaYokeItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) =>
      masterDataService.updatePokaYokeItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Updated', message: 'Poka Yoke item updated successfully.', color: 'green' });
      setEditPokaYokeModal(null);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to update item.',
        color: 'red',
      });
    },
  });

  const deletePokaYokeItemMutation = useMutation({
    mutationFn: (id: string) => masterDataService.deletePokaYokeItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Deleted', message: 'Poka Yoke item deleted successfully.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Error',
        message: err?.response?.data?.message || 'Failed to delete item.',
        color: 'red',
      });
    },
  });

  const filteredParts = parts.filter(
    (p) => {
      const matchesSearch = p.partNumber.toLowerCase().includes(search.toLowerCase()) ||
                            p.partName.toLowerCase().includes(search.toLowerCase());
      const matchesCustomer = selectedCustomer ? p.customerId === selectedCustomer : true;
      return matchesSearch && matchesCustomer;
    }
  );

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Master Data</Title>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="parts" leftSection={<Database size={16} />}>
            Parts & Parameters
          </Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<UploadCloud size={16} />}>
            Inspection Excel Upload
          </Tabs.Tab>
          <Tabs.Tab value="pokayoke-upload" leftSection={<UploadCloud size={16} />}>
            Poka Yoke Excel Upload
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="parts">
          <Group justify="flex-end" mb="md">
            <Select
              placeholder="Filter by Customer"
              data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              clearable
              searchable
              style={{ width: 250 }}
            />
            <TextInput
              placeholder="Search parts..."
              leftSection={<Search size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250 }}
            />
          </Group>

          <Paper withBorder radius="md">
            {isLoading ? (
              <div className="p-4"><TableSkeleton rows={6} /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table striped highlightOnHover style={{ minWidth: 700 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={{ width: 40 }}></Table.Th>
                      <Table.Th>Part Number</Table.Th>
                      <Table.Th>Part Name</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Operations</Table.Th>
                      <Table.Th style={{ minWidth: 60 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredParts.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#868e96' }}>
                          No parts found. Upload Excel to populate.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredParts.map((part) => (
                        <PartRow
                          key={part.id}
                          part={part}
                          appMode={appMode}
                          expanded={expandedParts.has(part.id)}
                          onToggle={() => toggleExpand(part.id)}
                          onEditPart={() => setEditPartModal(part)}
                          onDeletePart={() => {
                            modals.openConfirmModal({
                              title: 'Delete Part',
                              centered: true,
                              children: (
                                <Text size="sm">
                                  Are you sure you want to delete part <strong>{part.partNumber}</strong> and all its operations and parameters? This action cannot be undone.
                                </Text>
                              ),
                              labels: { confirm: 'Delete part', cancel: "Cancel" },
                              confirmProps: { color: 'red' },
                              onConfirm: () => deletePartMutation.mutate(part.id),
                            });
                          }}
                          onDeleteOp={(operationId) => {
                            modals.openConfirmModal({
                              title: 'Remove Operation',
                              centered: true,
                              children: (
                                <Text size="sm">
                                  Are you sure you want to remove this operation from <strong>{part.partNumber}</strong>?
                                </Text>
                              ),
                              labels: { confirm: 'Remove operation', cancel: "Cancel" },
                              confirmProps: { color: 'red' },
                              onConfirm: () => deleteOpMutation.mutate({ partId: part.id, operationId }),
                            });
                          }}
                          onEditOp={(operationId, opNum) => {
                            setEditPart({ partId: part.id, operationId, opNum });
                          }}
                          onEditOpDetails={(op) => {
                            setEditOpModal({ id: op.id, operationNumber: op.operationNumber, operationName: op.operationName });
                          }}
                          onDeletePokaYokeItem={(itemId) => {
                            modals.openConfirmModal({
                              title: 'Delete Poka Yoke Item',
                              centered: true,
                              children: (
                                <Text size="sm">
                                  Are you sure you want to delete this item permanently? This action cannot be undone.
                                </Text>
                              ),
                              labels: { confirm: 'Delete item', cancel: "Cancel" },
                              confirmProps: { color: 'red' },
                              onConfirm: () => deletePokaYokeItemMutation.mutate(itemId),
                            });
                          }}
                          onEditPokaYokeItem={(item) => {
                            setEditPokaYokeModal(item);
                          }}
                          onEditAllPokaYokeItems={(part) => {
                            setEditPokaYokePart({ partId: part.id, partNumber: part.partNumber, items: part.pokaYokeItems || [] });
                          }}
                        />
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="upload">
          <ExcelUpload onUploadSuccess={() => setActiveTab('parts')} />
        </Tabs.Panel>

        <Tabs.Panel value="pokayoke-upload">
          <PokaYokeExcelUpload onUploadSuccess={() => setActiveTab('parts')} />
        </Tabs.Panel>
      </Tabs>

      {/* Part Edit Modal */}
      <Modal
        opened={!!editPartModal}
        onClose={() => setEditPartModal(null)}
        title="Edit Part"
        centered
        overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
      >
        {editPartModal && (
          <EditPartForm
            part={editPartModal}
            customers={customers}
            onCancel={() => setEditPartModal(null)}
            onSubmit={(data) => updatePartMutation.mutate({ id: editPartModal.id, data })}
            isLoading={updatePartMutation.isPending}
          />
        )}
      </Modal>

      {/* Parameter Edit Modal */}
      <Modal
        opened={!!editPart}
        onClose={() => setEditPart(null)}
        title={`Edit Parameters — Operation ${editPart?.opNum}`}
        fullScreen
        transitionProps={{ transition: 'fade', duration: 200 }}
        overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
      >
        {editPart && (
          <ParameterEditor
            partId={editPart.partId}
            operationId={editPart.operationId}
            onClose={() => setEditPart(null)}
          />
        )}
      </Modal>

      {/* Operation Edit Modal */}
      <Modal
        opened={!!editOpModal}
        onClose={() => setEditOpModal(null)}
        title="Edit Operation"
        centered
        overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
      >
        {editOpModal && (
          <EditOpForm
            op={editOpModal}
            onCancel={() => setEditOpModal(null)}
            onSubmit={(data) => updateOpMutation.mutate({ id: editOpModal.id, data })}
            isLoading={updateOpMutation.isPending}
          />
        )}
      </Modal>

      {/* Poka Yoke Bulk Edit Modal */}
      <Modal
        opened={!!editPokaYokePart}
        onClose={() => setEditPokaYokePart(null)}
        title={`Edit Poka Yoke Items — Part ${editPokaYokePart?.partNumber}`}
        fullScreen
        transitionProps={{ transition: 'fade', duration: 200 }}
        overlayProps={{ backgroundOpacity: 0.55, blur: 0 }}
      >
        {editPokaYokePart && (
          <PokaYokeEditor
          partId={editPokaYokePart.partId}
          initialItems={editPokaYokePart.items}
          onClose={() => setEditPokaYokePart(null)}
          />
        )}
      </Modal>

      <Modal opened={!!editPokaYokeModal} onClose={() => setEditPokaYokeModal(null)} title="Edit Poka Yoke Item">
        {editPokaYokeModal && (
          <EditPokaYokeForm
            initialData={editPokaYokeModal}
            onCancel={() => setEditPokaYokeModal(null)}
            onSubmit={(data) => updatePokaYokeItemMutation.mutate({ id: editPokaYokeModal.id, data })}
            isLoading={updatePokaYokeItemMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

// Part Row with expand/collapse
function PartRow({
  part,
  appMode,
  expanded,
  onToggle,
  onEditPart,
  onDeletePart,
  onDeleteOp,
  onEditOp,
  onEditOpDetails,
  onDeletePokaYokeItem,
  onEditPokaYokeItem,
  onEditAllPokaYokeItems,
}: {
  part: PartWithOperations & { pokaYokeItems?: any[] };
  appMode: 'INSPECTION' | 'POKAYOKE';
  expanded: boolean;
  onToggle: () => void;
  onEditPart: () => void;
  onDeletePart: () => void;
  onDeleteOp: (operationId: string) => void;
  onEditOp: (operationId: string, opNum: string) => void;
  onEditOpDetails: (op: any) => void;
  onDeletePokaYokeItem?: (itemId: string) => void;
  onEditPokaYokeItem?: (item: any) => void;
  onEditAllPokaYokeItems?: (part: any) => void;
}) {
  return (
    <>
      <Table.Tr style={{ cursor: 'pointer' }} onClick={onToggle}>
        <Table.Td>
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </Table.Td>
        <Table.Td>
          <Text fw={600}>{part.partNumber}</Text>
        </Table.Td>
        <Table.Td>{part.partName}</Table.Td>
        <Table.Td>
          {part.customerName ? (
            <Badge variant="light" color="gray">{part.customerName}</Badge>
          ) : (
            <Text size="xs" c="dimmed">—</Text>
          )}
        </Table.Td>
        <Table.Td>
          <Badge variant="light" color={appMode === 'POKAYOKE' ? 'orange' : 'blue'}>
            {appMode === 'POKAYOKE'
              ? `${part.pokaYokeItems?.length || 0} Poka Yoke item(s)`
              : `${part.operations.length} operation(s)`}
          </Badge>
        </Table.Td>
        <Table.Td>
          <Group gap="xs" wrap="nowrap">
            {appMode === 'POKAYOKE' && (
              <Tooltip label="Edit Poka Yoke Items">
                <ActionIcon
                  variant="subtle"
                  color="yellow"
                  onClick={(e) => { e.stopPropagation(); onEditAllPokaYokeItems?.(part); }}
                >
                  <Database size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Tooltip label="Edit Part">
              <ActionIcon
                variant="subtle"
                color="blue"
                onClick={(e) => { e.stopPropagation(); onEditPart(); }}
              >
                <Edit size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Delete Part">
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={(e) => { e.stopPropagation(); onDeletePart(); }}
              >
                <Trash2 size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Table.Td>
      </Table.Tr>
      {expanded && (
        <Table.Tr>
          <Table.Td colSpan={6} style={{ padding: 0 }}>
            <Collapse in={expanded}>
              <div style={{ padding: '8px 16px 16px 48px' }} className="bg-gray-50 dark:bg-[#1f2025]">
                {appMode === 'POKAYOKE' ? (
                  part.pokaYokeItems && part.pokaYokeItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table withTableBorder withColumnBorders style={{ minWidth: 800 }}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Operation</Table.Th>
                            <Table.Th>Poka Yoke Item</Table.Th>
                            <Table.Th>Checking Method</Table.Th>
                            <Table.Th>Frequency</Table.Th>
                            <Table.Th style={{ minWidth: 100 }}>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {part.pokaYokeItems.map((pyItem: any) => (
                            <Table.Tr key={pyItem.id}>
                              <Table.Td>{pyItem.operation}</Table.Td>
                              <Table.Td>{pyItem.pokaYokeName}</Table.Td>
                              <Table.Td>{pyItem.checkingMethod || '-'}</Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="gray">{pyItem.frequency || 'N/A'}</Badge>
                              </Table.Td>
                              <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                  <Tooltip label="Edit Item">
                                    <ActionIcon variant="light" color="blue" onClick={() => onEditPokaYokeItem?.(pyItem)}>
                                      <Edit size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Delete Item">
                                    <ActionIcon variant="light" color="red" onClick={() => onDeletePokaYokeItem?.(pyItem.id)}>
                                      <Trash2 size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  ) : (
                    <Text size="sm" c="dimmed" py="sm">
                      No Poka Yoke items assigned to this part.
                    </Text>
                  )
                ) : (
                  part.operations.length === 0 ? (
                    <Text size="sm" c="dimmed" py="sm">
                      No operations assigned to this part.
                    </Text>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table withTableBorder withColumnBorders style={{ minWidth: 600 }}>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Operation No</Table.Th>
                            <Table.Th>Operation Name</Table.Th>
                            <Table.Th>Parameters</Table.Th>
                            <Table.Th style={{ minWidth: 150 }}>Actions</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {part.operations.map((op) => (
                            <Table.Tr key={op.id}>
                              <Table.Td>
                                <Text fw={500}>{op.operationNumber}</Text>
                              </Table.Td>
                              <Table.Td>{op.operationName}</Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="teal" size="sm">
                                  {op.parameterCount} parameter(s)
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                  <Tooltip label="Edit Operation Details">
                                    <ActionIcon variant="light" color="blue" onClick={() => onEditOpDetails(op)}>
                                      <Edit size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Edit Parameters">
                                    <ActionIcon variant="light" color="teal" onClick={() => onEditOp(op.id, op.operationNumber)}>
                                      <Database size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Delete Operation">
                                    <ActionIcon variant="light" color="red" onClick={() => onDeleteOp(op.id)}>
                                      <Trash2 size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </div>
                  )
                )}
              </div>
            </Collapse>
          </Table.Td>
        </Table.Tr>
      )}
    </>
  );
}

// Full-screen parameter editor
function ParameterEditor({
  partId,
  operationId,
  onClose,
}: {
  partId: string;
  operationId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editedParams, setEditedParams] = useState<InspectionParameter[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: params = [], isLoading } = useQuery({
    queryKey: ['parameters', partId, operationId],
    queryFn: () => masterDataService.getParameters(partId, operationId),
  });

  // Sync local state from fetched data
  useState(() => {
    if (params.length > 0 && editedParams.length === 0) {
      setEditedParams([...params]);
    }
  });

  // Update local state when params load
  if (params.length > 0 && editedParams.length === 0) {
    setEditedParams([...params]);
  }

  const saveMutation = useMutation({
    mutationFn: () => masterDataService.updateParameters(editedParams),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', partId, operationId] });
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Saved', message: 'Parameters updated successfully.', color: 'green' });
      setDirty(false);
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to save.', color: 'red' });
    },
  });

  const updateField = (index: number, field: string, value: any) => {
    setEditedParams((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
  };

  const deleteMutation = useMutation({
    mutationFn: masterDataService.deleteParameter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', partId, operationId] });
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Deleted', message: 'Parameter deleted successfully.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to delete.', color: 'red' });
    },
  });

  const handleAddParameter = () => {
    const newParam: InspectionParameter = {
      id: `new-${Date.now()}`,
      partId,
      operationId,
      parameterName: '',
      nominalValue: null,
      lowerTolerance: null,
      upperTolerance: null,
      specText: '',
      controlLimitMin: null,
      controlLimitMax: null,
      methodOfChecking: '',
      freqOfInspn: '',
      frequencyUnit: 'shift',
      leastCount: null,
      class: null,
      sequence: editedParams.length + 1,
    };
    setEditedParams([...editedParams, newParam]);
    setDirty(true);
  };

  const handleRemoveParameter = (id: string, index: number) => {
    if (id.startsWith('new-')) {
      // Just remove from local state
      const next = [...editedParams];
      next.splice(index, 1);
      setEditedParams(next);
      setDirty(true);
    } else {
      // Remove from backend
      modals.openConfirmModal({
        title: 'Delete Parameter',
        centered: true,
        children: (
          <Text size="sm">
            Are you sure you want to delete this parameter permanently? This action cannot be undone.
          </Text>
        ),
        labels: { confirm: 'Delete parameter', cancel: "Cancel" },
        confirmProps: { color: 'red' },
        onConfirm: () => deleteMutation.mutate(id),
      });
    }
  };

  if (isLoading) {
    return <div className="p-4"><TableSkeleton rows={5} /></div>;
  }

  return (
    <div>
      <Group justify="space-between" mb="md">
        <Text fw={600}>
          {editedParams.length} Parameter(s)
        </Text>
        <Group gap="sm">
          <Button
            variant="light"
            leftSection={<Plus size={16} />}
            onClick={handleAddParameter}
          >
            Add Parameter
          </Button>
          <Button
            leftSection={<Save size={16} />}
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!dirty}
          >
            Save Changes
          </Button>
          <Button variant="subtle" leftSection={<X size={16} />} onClick={onClose}>
            Close
          </Button>
        </Group>
      </Group>

      <div style={{ overflowX: 'auto' }}>
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ minWidth: 40 }}>#</Table.Th>
              <Table.Th style={{ minWidth: 200 }}>Parameter Name</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Class</Table.Th>
              <Table.Th style={{ minWidth: 180 }}>SPEC</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Nominal</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Limit MIN</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Limit MAX</Table.Th>
              <Table.Th style={{ minWidth: 160 }}>Method of Checking</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Freq. of Inspn.</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Freq. Unit</Table.Th>
              <Table.Th style={{ minWidth: 90 }}>LC</Table.Th>
              <Table.Th style={{ minWidth: 60 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {editedParams.map((param, idx) => (
              <Table.Tr key={param.id}>
                <Table.Td>
                  <NumberInput
                    value={param.sequence}
                    onChange={(v) => updateField(idx, 'sequence', v || 0)}
                    size="xs"
                    hideControls
                    styles={{ input: { textAlign: 'center' } }}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={param.parameterName}
                    onChange={(e) => updateField(idx, 'parameterName', e.target.value)}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={param.class || ''}
                    onChange={(e) => updateField(idx, 'class', e.target.value || null)}
                    size="xs"
                    placeholder="-"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={param.specText || ''}
                    onChange={(e) => updateField(idx, 'specText', e.target.value)}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={param.nominalValue || ''}
                    onChange={(e) => updateField(idx, 'nominalValue', e.target.value)}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    value={param.controlLimitMin ?? ''}
                    onChange={(v) => updateField(idx, 'controlLimitMin', v === '' ? null : v)}
                    size="xs"
                    hideControls
                    placeholder="-"
                    decimalScale={4}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    value={param.controlLimitMax ?? ''}
                    onChange={(v) => updateField(idx, 'controlLimitMax', v === '' ? null : v)}
                    size="xs"
                    hideControls
                    placeholder="-"
                    decimalScale={4}
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={param.methodOfChecking || ''}
                    onChange={(e) => updateField(idx, 'methodOfChecking', e.target.value)}
                    size="xs"
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    value={param.freqOfInspn || ''}
                    onChange={(v) => updateField(idx, 'freqOfInspn', v || '')}
                    data={param.frequencyUnit === 'day' ? ['1', '2', '3'] : ['1', '2', '4']}
                    size="xs"
                    allowDeselect={false}
                    placeholder="Select"
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    value={param.frequencyUnit || 'shift'}
                    onChange={(v) => updateField(idx, 'frequencyUnit', v || 'shift')}
                    data={[
                      { value: 'shift', label: 'Shift-wise' },
                      { value: 'day', label: 'Day-wise' }
                    ]}
                    size="xs"
                    allowDeselect={false}
                  />
                </Table.Td>
                <Table.Td>
                  <NumberInput
                    value={param.leastCount ?? ''}
                    onChange={(v) => updateField(idx, 'leastCount', v === '' ? null : v)}
                    size="xs"
                    hideControls
                    placeholder="-"
                    decimalScale={4}
                    step={0.001}
                  />
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Delete Parameter">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleRemoveParameter(param.id, idx)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </div>
  );
}

// Edit Part Form Component
function EditPartForm({
  part,
  customers,
  onCancel,
  onSubmit,
  isLoading,
}: {
  part: PartWithOperations;
  customers: any[];
  onCancel: () => void;
  onSubmit: (data: { partNumber: string; partName: string; customerId: string | null }) => void;
  isLoading: boolean;
}) {
  const [partNumber, setPartNumber] = useState(part.partNumber);
  const [partName, setPartName] = useState(part.partName);
  const [customerId, setCustomerId] = useState<string | null>(part.customerId || null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ partNumber, partName, customerId });
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextInput
        label="Part Number"
        value={partNumber}
        onChange={(e) => setPartNumber(e.target.value)}
        required
        mb="md"
      />
      <TextInput
        label="Part Name"
        value={partName}
        onChange={(e) => setPartName(e.target.value)}
        required
        mb="md"
      />
      <Select
        label="Customer"
        placeholder="Unassigned"
        data={customers.map((c) => ({ value: c.id, label: c.name }))}
        value={customerId}
        onChange={setCustomerId}
        clearable
        searchable
        mb="xl"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Save Changes
        </Button>
      </Group>
    </form>
  );
}

// Edit Operation Form Component
function EditOpForm({
  op,
  onCancel,
  onSubmit,
  isLoading,
}: {
  op: { operationNumber: string; operationName: string };
  onCancel: () => void;
  onSubmit: (data: { operationNumber: string; operationName: string }) => void;
  isLoading: boolean;
}) {
  const [operationNumber, setOperationNumber] = useState(op.operationNumber);
  const [operationName, setOperationName] = useState(op.operationName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ operationNumber, operationName });
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextInput
        label="Operation Number"
        value={operationNumber}
        onChange={(e) => setOperationNumber(e.target.value)}
        required
        mb="md"
      />
      <TextInput
        label="Operation Name"
        value={operationName}
        onChange={(e) => setOperationName(e.target.value)}
        required
        mb="xl"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Save Changes
        </Button>
      </Group>
    </form>
  );
}

// Edit Poka Yoke Form Component
function EditPokaYokeForm({
  initialData,
  onCancel,
  onSubmit,
  isLoading,
}: {
  initialData: any;
  onCancel: () => void;
  onSubmit: (data: { pokaYokeName: string; checkingMethod: string; frequency: string; readingType: string }) => void;
  isLoading: boolean;
}) {
  const [pokaYokeName, setPokaYokeName] = useState(initialData.pokaYokeName || '');
  const [checkingMethod, setCheckingMethod] = useState(initialData.checkingMethod || '');
  const [frequency, setFrequency] = useState(initialData.frequency || '');
  const [readingType, setReadingType] = useState(initialData.readingType || 'number');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ pokaYokeName, checkingMethod, frequency, readingType });
  };

  return (
    <form onSubmit={handleSubmit}>
      <TextInput
        label="Poka Yoke Item Name"
        value={pokaYokeName}
        onChange={(e) => setPokaYokeName(e.target.value)}
        required
        mb="md"
      />
      <TextInput
        label="Checking Method"
        value={checkingMethod}
        onChange={(e) => setCheckingMethod(e.target.value)}
        mb="md"
      />
      <TextInput
        label="Frequency"
        value={frequency}
        onChange={(e) => setFrequency(e.target.value)}
        mb="md"
      />
      <Select
        label="Reading Type"
        value={readingType}
        onChange={(v) => setReadingType(v || 'number')}
        data={[
          { value: 'number', label: 'Number (with Unit)' },
          { value: 'text', label: 'Free Text' },
          { value: 'ok_ng', label: 'OK/NG' }
        ]}
        allowDeselect={false}
        mb="xl"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Save Changes
        </Button>
      </Group>
    </form>
  );
}

// Bulk Poka Yoke Editor Component
function PokaYokeEditor({
  partId,
  initialItems,
  onClose,
}: {
  partId: string;
  initialItems: any[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [editedItems, setEditedItems] = useState<any[]>([...initialItems]);
  const [dirty, setDirty] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => masterDataService.bulkUpdatePokaYokeItems(partId, editedItems),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
      notifications.show({ title: 'Saved', message: 'Poka Yoke items updated successfully.', color: 'green' });
      setDirty(false);
      onClose();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to save.', color: 'red' });
    },
  });

  const updateField = (index: number, field: string, value: any) => {
    setEditedItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    setDirty(true);
  };

  const handleAddItem = () => {
    setEditedItems((prev) => [
      ...prev,
      {
        id: '', // Empty ID indicates new
        operation: '',
        pokaYokeName: '',
        checkingMethod: '',
        frequency: '',
        readingType: 'number'
      }
    ]);
    setDirty(true);
  };

  const handleRemoveItem = (index: number) => {
    setEditedItems((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#1a1b1e]">
      <Group justify="space-between" p="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        <Title order={3}>{editedItems.length} Poka Yoke Item(s)</Title>
        <Group>
          <Button variant="light" leftSection={<Plus size={16} />} onClick={handleAddItem}>
            Add Item
          </Button>
          <Button
            leftSection={<Save size={16} />}
            disabled={!dirty}
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
          >
            Save Changes
          </Button>
          <Button variant="subtle" color="gray" onClick={onClose}>
            <X size={16} /> Close
          </Button>
        </Group>
      </Group>

      <div className="flex-1 overflow-auto p-4">
        <Table withTableBorder withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 60 }}>#</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Operation</Table.Th>
              <Table.Th style={{ minWidth: 200 }}>Poka Yoke Item</Table.Th>
              <Table.Th style={{ minWidth: 150 }}>Checking Method</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Frequency</Table.Th>
              <Table.Th style={{ minWidth: 120 }}>Reading Type</Table.Th>
              <Table.Th style={{ width: 60 }}>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {editedItems.map((item, idx) => (
              <Table.Tr key={idx}>
                <Table.Td>{idx + 1}</Table.Td>
                <Table.Td>
                  <TextInput
                    value={item.operation}
                    onChange={(e) => updateField(idx, 'operation', e.target.value)}
                    size="xs"
                    placeholder="e.g. OP10"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={item.pokaYokeName}
                    onChange={(e) => updateField(idx, 'pokaYokeName', e.target.value)}
                    size="xs"
                    placeholder="Name"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={item.checkingMethod || ''}
                    onChange={(e) => updateField(idx, 'checkingMethod', e.target.value)}
                    size="xs"
                    placeholder="Method"
                  />
                </Table.Td>
                <Table.Td>
                  <TextInput
                    value={item.frequency || ''}
                    onChange={(e) => updateField(idx, 'frequency', e.target.value)}
                    size="xs"
                    placeholder="Frequency"
                  />
                </Table.Td>
                <Table.Td>
                  <Select
                    value={item.readingType || 'number'}
                    onChange={(v) => updateField(idx, 'readingType', v || 'number')}
                    data={[
                      { value: 'number', label: 'Number' },
                      { value: 'text', label: 'Text' },
                      { value: 'ok_ng', label: 'OK/NG' }
                    ]}
                    size="xs"
                    allowDeselect={false}
                  />
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Delete Item">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleRemoveItem(idx)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    </div>
  );
}
