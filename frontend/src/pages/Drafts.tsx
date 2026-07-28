import { Title, Paper, Table, ActionIcon, Group, Text, Badge, Button } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { inspectionService } from '../services/inspection.service';
import api from '../lib/axios';
import { notifications } from '@mantine/notifications';
import { format } from 'date-fns';
import { TableSkeleton } from '../components/TableSkeleton';
import { useAuthStore } from '../store/auth-store';

export function Drafts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { appMode } = useAuthStore();

  const isPokaYoke = appMode === 'POKAYOKE';

  // Query Inspection Drafts
  const { data: inspectionDrafts = [], isLoading: inspectionLoading } = useQuery({
    queryKey: ['drafts'],
    queryFn: inspectionService.getDrafts,
    enabled: !isPokaYoke
  });

  // Query Poka Yoke Drafts
  const { data: pokaYokeDrafts = [], isLoading: pokaYokeLoading } = useQuery({
    queryKey: ['pokayoke-all-drafts'],
    queryFn: async () => {
      const { data } = await api.get('/pokayoke/drafts');
      return Array.isArray(data) ? data : (data ? [data] : []);
    },
    enabled: isPokaYoke
  });

  // Delete Inspection Draft
  const deleteInspectionMutation = useMutation({
    mutationFn: inspectionService.deleteDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      notifications.show({ title: 'Deleted', message: 'Inspection draft deleted successfully', color: 'green' });
    }
  });

  // Delete Poka Yoke Draft
  const deletePokaYokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/pokayoke/drafts/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pokayoke-all-drafts'] });
      notifications.show({ title: 'Deleted', message: 'Poka Yoke draft deleted successfully', color: 'green' });
    }
  });

  const handleResumeInspection = (draft: any) => {
    navigate(`/inspection?partId=${draft.partId}&opId=${draft.operationId}`);
  };

  const handleResumePokaYoke = (draft: any) => {
    navigate(`/pokayoke/entry?partId=${draft.partId}`);
  };

  const handleDeleteInspection = (id: string) => {
    if (confirm('Are you sure you want to delete this inspection draft?')) {
      deleteInspectionMutation.mutate(id);
    }
  };

  const handleDeletePokaYoke = (id: string) => {
    if (confirm('Are you sure you want to delete this Poka Yoke draft?')) {
      deletePokaYokeMutation.mutate(id);
    }
  };

  if (isPokaYoke) {
    return (
      <div className="space-y-6">
        <Title order={2}>Saved Poka Yoke Drafts</Title>

        <Paper shadow="sm" radius="md" withBorder className="overflow-hidden">
          {pokaYokeLoading ? (
            <div className="p-4"><TableSkeleton rows={4} /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table verticalSpacing="sm" striped highlightOnHover style={{ minWidth: 700 }}>
                <Table.Thead className="bg-gray-50 dark:bg-[#25262b]">
                  <Table.Tr>
                    <Table.Th>Saved On</Table.Th>
                    <Table.Th>Part Number</Table.Th>
                    <Table.Th>Inspection Date</Table.Th>
                    <Table.Th>Shift</Table.Th>
                    <Table.Th style={{ minWidth: 120 }}>Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {pokaYokeDrafts.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={5}>
                        <Text c="dimmed" ta="center" py="xl">
                          No saved Poka Yoke drafts found.
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    pokaYokeDrafts.map((draft: any) => (
                      <Table.Tr key={draft.id}>
                        <Table.Td>
                          {format(new Date(draft.updatedAt), 'dd MMM yyyy, HH:mm')}
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500}>{draft.part?.partNumber || draft.partId}</Text>
                        </Table.Td>
                        <Table.Td>
                          {draft.date ? format(new Date(draft.date), 'dd MMM yyyy') : '-'}
                        </Table.Td>
                        <Table.Td>{draft.shift?.name || draft.shiftId || '-'}</Table.Td>
                        <Table.Td>
                          <Group gap="sm" wrap="nowrap">
                            <Button size="xs" variant="light" color="teal" leftSection={<Edit size={14} />} onClick={() => handleResumePokaYoke(draft)}>
                              Resume
                            </Button>
                            <ActionIcon variant="subtle" color="red" onClick={() => handleDeletePokaYoke(draft.id)}>
                              <Trash2 size={16} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Paper>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Title order={2}>Saved Inspection Drafts</Title>

      <Paper shadow="sm" radius="md" withBorder className="overflow-hidden">
        {inspectionLoading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table verticalSpacing="sm" striped highlightOnHover style={{ minWidth: 700 }}>
              <Table.Thead className="bg-gray-50 dark:bg-[#25262b]">
                <Table.Tr>
                  <Table.Th>Saved On</Table.Th>
                  <Table.Th>Part Number</Table.Th>
                  <Table.Th>Operation</Table.Th>
                  <Table.Th>Shift</Table.Th>
                  <Table.Th>Interval</Table.Th>
                  <Table.Th style={{ minWidth: 120 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {inspectionDrafts.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={6}>
                      <Text c="dimmed" ta="center" py="xl">
                        No saved inspection drafts found.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  inspectionDrafts.map((draft: any) => (
                    <Table.Tr key={draft.id}>
                      <Table.Td>
                        {format(new Date(draft.updatedAt), 'dd MMM yyyy, HH:mm')}
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>{draft.part?.partNumber}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">{draft.operation?.operationNumber}</Badge>
                      </Table.Td>
                      <Table.Td>{draft.shiftId || '-'}</Table.Td>
                      <Table.Td>{draft.intervalName || '-'}</Table.Td>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Button size="xs" variant="light" leftSection={<Edit size={14} />} onClick={() => handleResumeInspection(draft)}>
                            Resume
                          </Button>
                          <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteInspection(draft.id)}>
                            <Trash2 size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Paper>
    </div>
  );
}
