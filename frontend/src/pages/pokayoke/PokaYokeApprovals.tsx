import { Title, Table, Button, Badge, Group, Text, Card, Stack, Loader, Center } from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';
import { notifications } from '@mantine/notifications';
import { Check, X } from 'lucide-react';
import { format } from 'date-fns';

export function PokaYokeApprovals() {
  const queryClient = useQueryClient();

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['pokayoke-pending-approvals'],
    queryFn: async () => {
      const { data } = await api.get('/pokayoke/approvals/pending');
      return data;
    },
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
      queryClient.invalidateQueries({ queryKey: ['pokayoke-pending-approvals'] });
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

  if (isLoading) {
    return (
      <Center p="xl">
        <Loader size="lg" />
      </Center>
    );
  }

  return (
    <div>
      <Title order={2} mb="lg">Pending Approvals</Title>

      {approvals.length === 0 ? (
        <Text c="dimmed">No pending Poka Yoke approvals at this time.</Text>
      ) : (
        <Stack gap="lg">
          {approvals.map((txn: any) => (
            <Card key={txn.id} withBorder shadow="sm" radius="md">
              <Group justify="space-between" mb="md">
                <div>
                  <Text fw={600} size="lg">Part: {txn.part.partNumber} - {txn.part.partName}</Text>
                  <Text size="sm" c="dimmed">Date: {format(new Date(txn.date), 'MMMM d, yyyy')}</Text>
                  <Text size="sm" c="dimmed">Inspector: {txn.inspector.name}</Text>
                </div>
                <Group>
                  <Badge color="red" variant="light" size="lg">REJECTED</Badge>
                  <Button 
                    color="green" 
                    onClick={() => approveMutation.mutate(txn.id)}
                    loading={approveMutation.isPending}
                  >
                    Approve
                  </Button>
                </Group>
              </Group>

              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Poka Yoke Item</Table.Th>
                    <Table.Th>Checking Method</Table.Th>
                    <Table.Th>Value</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Correction Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {txn.details.map((detail: any) => (
                    <Table.Tr key={detail.id}>
                      <Table.Td>{detail.pokaYokeItem?.pokaYokeName || 'Unknown Item'}</Table.Td>
                      <Table.Td>{detail.pokaYokeItem?.checkingMethod || 'N/A'}</Table.Td>
                      <Table.Td>{detail.observedValue}</Table.Td>
                      <Table.Td>
                        <Badge color={detail.status === 'PASS' ? 'green' : 'red'}>
                          {detail.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {detail.correctionAction ? (
                          <Text size="sm" c="red" fw={500}>{detail.correctionAction}</Text>
                        ) : (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          ))}
        </Stack>
      )}
    </div>
  );
}
