import { useState } from 'react';
import {
  Title, Paper, Table, Group, TextInput, Text, Badge,
  ActionIcon, Tooltip, Collapse, Modal, Button,
  NumberInput, Tabs,
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
import { TableSkeleton } from '../components/TableSkeleton';

export function MasterData() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());

  // Edit modal state
  const [editPart, setEditPart] = useState<{ partId: string; operationId: string; opNum: string } | null>(null);

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

  const filteredParts = parts.filter(
    (p) =>
      p.partNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.partName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Master Data</Title>
      </Group>

      <Tabs defaultValue="parts">
        <Tabs.List mb="lg">
          <Tabs.Tab value="parts" leftSection={<Database size={16} />}>
            Parts & Parameters
          </Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<UploadCloud size={16} />}>
            Excel Upload
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="parts">
          <Group justify="flex-end" mb="md">
            <TextInput
              placeholder="Search parts..."
              leftSection={<Search size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                      <Table.Th>Operations</Table.Th>
                      <Table.Th style={{ minWidth: 60 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {filteredParts.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#868e96' }}>
                          No parts found. Upload Excel to populate.
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      filteredParts.map((part) => (
                        <PartRow
                          key={part.id}
                          part={part}
                          expanded={expandedParts.has(part.id)}
                          onToggle={() => toggleExpand(part.id)}
                          onDeletePart={() => {
                            if (confirm(`Delete part "${part.partNumber}" and all its operations/parameters?`)) {
                              deletePartMutation.mutate(part.id);
                            }
                          }}
                          onDeleteOp={(operationId) => {
                            if (confirm(`Remove this operation from "${part.partNumber}"?`)) {
                              deleteOpMutation.mutate({ partId: part.id, operationId });
                            }
                          }}
                          onEditOp={(operationId, opNum) => {
                            setEditPart({ partId: part.id, operationId, opNum });
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
          <ExcelUpload />
        </Tabs.Panel>
      </Tabs>

      {/* Parameter Edit Modal */}
      <Modal
        opened={!!editPart}
        onClose={() => setEditPart(null)}
        title={`Edit Parameters — Operation ${editPart?.opNum}`}
        fullScreen
        transitionProps={{ transition: 'fade', duration: 200 }}
      >
        {editPart && (
          <ParameterEditor
            partId={editPart.partId}
            operationId={editPart.operationId}
            onClose={() => setEditPart(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// Part Row with expand/collapse
function PartRow({
  part,
  expanded,
  onToggle,
  onDeletePart,
  onDeleteOp,
  onEditOp,
}: {
  part: PartWithOperations;
  expanded: boolean;
  onToggle: () => void;
  onDeletePart: () => void;
  onDeleteOp: (operationId: string) => void;
  onEditOp: (operationId: string, opNum: string) => void;
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
          <Badge variant="light" color="blue">
            {part.operations.length} operation(s)
          </Badge>
        </Table.Td>
        <Table.Td>
          <Tooltip label="Delete Part">
            <ActionIcon
              variant="subtle"
              color="red"
              onClick={(e) => { e.stopPropagation(); onDeletePart(); }}
            >
              <Trash2 size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
      {expanded && (
        <Table.Tr>
          <Table.Td colSpan={5} style={{ padding: 0 }}>
            <Collapse in={expanded}>
              <div style={{ padding: '8px 16px 16px 48px', background: '#f8f9fa' }}>
                {part.operations.length === 0 ? (
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
                          <Table.Th style={{ minWidth: 100 }}>Actions</Table.Th>
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
                              <Group gap={4} wrap="nowrap">
                                <Tooltip label="Edit Parameters">
                                  <ActionIcon
                                    variant="subtle"
                                    color="blue"
                                    onClick={() => onEditOp(op.id, op.operationNumber)}
                                  >
                                    <Edit size={16} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Remove Operation">
                                  <ActionIcon
                                    variant="subtle"
                                    color="red"
                                    onClick={() => onDeleteOp(op.id)}
                                  >
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
      if (confirm('Are you sure you want to delete this parameter permanently?')) {
        deleteMutation.mutate(id);
      }
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
                  <TextInput
                    value={param.freqOfInspn || ''}
                    onChange={(e) => updateField(idx, 'freqOfInspn', e.target.value)}
                    size="xs"
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
