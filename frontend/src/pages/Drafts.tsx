import { Title, Paper, Table, ActionIcon, Group, Text, Badge, Button } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { inspectionService } from '../services/inspection.service';
import { notifications } from '@mantine/notifications';
import { format } from 'date-fns';

export function Drafts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: drafts = [] } = useQuery({
    queryKey: ['drafts'],
    queryFn: inspectionService.getDrafts
  });

  const deleteMutation = useMutation({
    mutationFn: inspectionService.deleteDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      notifications.show({ title: 'Deleted', message: 'Draft deleted successfully', color: 'green' });
    }
  });

  const handleResume = (draft: any) => {
    navigate(`/inspection?partId=${draft.partId}&opId=${draft.operationId}`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this draft?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <Title order={2}>Saved Drafts</Title>
      
      <Paper shadow="sm" radius="md" withBorder className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table verticalSpacing="sm" striped highlightOnHover style={{ minWidth: 700 }}>
            <Table.Thead className="bg-gray-50">
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
              {drafts.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text c="dimmed" ta="center" py="xl">
                      No saved drafts found.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                drafts.map((draft: any) => (
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
                        <Button size="xs" variant="light" leftSection={<Edit size={14} />} onClick={() => handleResume(draft)}>
                          Resume
                        </Button>
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(draft.id)}>
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
      </Paper>
    </div>
  );
}
