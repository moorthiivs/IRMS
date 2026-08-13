import { Title, Paper, Table, ActionIcon, Group, Text, Badge, Button } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { spcService } from '../../services/spc.service';
import { notifications } from '@mantine/notifications';
import { format } from 'date-fns';
import { TableSkeleton } from '../../components/TableSkeleton';

export function SpcDrafts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['spc-drafts'],
    queryFn: spcService.getDrafts,
  });

  const deleteMutation = useMutation({
    mutationFn: spcService.deleteDraft,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spc-drafts'] });
      notifications.show({ title: 'Deleted', message: 'Saved SPC draft deleted successfully', color: 'green' });
    },
  });

  const handleResume = (draft: any) => {
    navigate(`/spc/entry?partId=${draft.partId}&opId=${draft.operationId}`);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this SPC draft?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title order={2}>Saved SPC Drafts</Title>
          <Text size="sm" c="dimmed">Manage in-progress Statistical Process Control measurement entries</Text>
        </div>
      </div>

      <Paper shadow="sm" radius="md" withBorder className="overflow-hidden">
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table verticalSpacing="sm" striped highlightOnHover style={{ minWidth: 800 }}>
              <Table.Thead className="bg-gray-50 dark:bg-[#25262b]">
                <Table.Tr>
                  <Table.Th>Saved On</Table.Th>
                  <Table.Th>Part Number</Table.Th>
                  <Table.Th>Operation</Table.Th>
                  <Table.Th>Shift</Table.Th>
                  <Table.Th>M/C No</Table.Th>
                  <Table.Th>Interval</Table.Th>
                  <Table.Th style={{ minWidth: 120 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {drafts.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={7}>
                      <Text c="dimmed" ta="center" py="xl">
                        No saved SPC drafts found. All clear!
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  drafts.map((draft: any) => (
                    <Table.Tr key={draft.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {draft.updatedAt ? format(new Date(draft.updatedAt), 'MMM dd, yyyy HH:mm') : 'Recently'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color="blue">
                          {draft.part?.partNumber || draft.partId}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{draft.operation?.operationNumber || draft.operationId}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{draft.shift?.name || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{draft.mcNo || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="outline" color="cyan">{draft.intervalName || '1 Half'}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            color="blue"
                            leftSection={<Edit size={14} />}
                            onClick={() => handleResume(draft)}
                          >
                            Resume
                          </Button>
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => handleDelete(draft.id)}
                            loading={deleteMutation.isPending}
                          >
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
