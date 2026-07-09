import { useState } from 'react';
import {
  Title, Paper, Table, Group, Badge, ActionIcon, Button, Text, TextInput, Modal, Tooltip, Skeleton
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2, Package } from 'lucide-react';
import { masterDataService } from '../services/master-data.service';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useAuthStore } from '../store/auth-store';

export function Customers() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [machines, setMachines] = useState<string[]>([]);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const createMutation = useMutation({
    mutationFn: () => masterDataService.createCustomer(name, code || undefined, machines.filter(m => m.trim() !== '')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      notifications.show({ title: 'Created', message: 'Customer created successfully.', color: 'green' });
      closeModal();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to create customer.', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => masterDataService.updateCustomer(editingId!, name, code || undefined, machines.filter(m => m.trim() !== '')),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      notifications.show({ title: 'Updated', message: 'Customer updated successfully.', color: 'green' });
      closeModal();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to update customer.', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: masterDataService.deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      notifications.show({ title: 'Deleted', message: 'Customer deleted.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to delete.', color: 'red' });
    },
  });

  const closeModal = () => {
    setModalOpened(false);
    setEditingId(null);
    setName('');
    setCode('');
    setMachines([]);
  };

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setMachines([]);
    setModalOpened(true);
  };

  const openEdit = (customer: any) => {
    setEditingId(customer.id);
    setName(customer.name);
    setCode(customer.code || '');
    setMachines(customer.machines || []);
    setModalOpened(true);
  };

  const handleDelete = (customer: any) => {
    modals.openConfirmModal({
      title: 'Delete Customer',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{customer.name}</strong>? Parts assigned to this customer will be unlinked.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(customer.id),
    });
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Customers</Title>
          <Text c="dimmed" size="sm">Manage customers and their linked parts</Text>
        </div>
        {isAdmin && (
          <Button leftSection={<Plus size={16} />} onClick={openCreate}>
            Add Customer
          </Button>
        )}
      </Group>

      <Paper withBorder p="md" radius="md">
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <Skeleton key={i} height={48} radius="sm" />)}
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <Text size="lg" fw={500} c="dimmed">No customers yet</Text>
            <Text size="sm" c="dimmed" mb="lg">Add your first customer to start linking parts</Text>
            {isAdmin && (
              <Button leftSection={<Plus size={16} />} onClick={openCreate}>
                Add Customer
              </Button>
            )}
          </div>
        ) : (
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Customer Name</Table.Th>
                <Table.Th>Code</Table.Th>
                <Table.Th>Machines</Table.Th>
                <Table.Th className="text-center">Linked Parts</Table.Th>
                <Table.Th>Created</Table.Th>
                {isAdmin && <Table.Th style={{ width: 100 }}>Actions</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {customers.map((customer: any) => (
                <Table.Tr key={customer.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Building2 size={16} className="text-blue-500" />
                      <Text fw={600}>{customer.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {customer.code ? (
                      <Badge variant="light" color="gray" size="sm">{customer.code}</Badge>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {customer.machines && customer.machines.length > 0 ? (
                      <Badge variant="dot" color="teal" size="sm">
                        {customer.machines.length} Machines
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                  <Table.Td className="text-center">
                    <Badge variant="light" color="blue" size="sm" leftSection={<Package size={10} />}>
                      {customer._count?.parts || 0} parts
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '—'}
                    </Text>
                  </Table.Td>
                  {isAdmin && (
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Tooltip label="Edit">
                          <ActionIcon variant="light" color="blue" onClick={() => openEdit(customer)}>
                            <Pencil size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon variant="light" color="red" onClick={() => handleDelete(customer)} loading={deleteMutation.isPending}>
                            <Trash2 size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Create/Edit Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingId ? 'Edit Customer' : 'Create Customer'}
        centered
      >
        <TextInput
          label="Customer Name"
          placeholder="e.g. XYZ Industries"
          value={name}
          onChange={(e) => setName(e.target.value)}
          mb="md"
          required
        />
        <TextInput
          label="Short Code (optional)"
          placeholder="e.g. XYZ"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          mb="sm"
        />
        
        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>Machines</Text>
            <Button size="compact-xs" variant="light" leftSection={<Plus size={12}/>} onClick={() => setMachines([...machines, ''])}>
              Add Machine
            </Button>
          </Group>
          {machines.length === 0 && (
            <Text size="xs" c="dimmed" mb="sm">No machines added yet.</Text>
          )}
          {machines.map((mc, index) => (
            <Group key={index} mb="xs" wrap="nowrap">
              <TextInput
                style={{ flex: 1 }}
                placeholder="Machine Number"
                value={mc}
                onChange={(e) => {
                  const newMachines = [...machines];
                  newMachines[index] = e.target.value;
                  setMachines(newMachines);
                }}
              />
              <ActionIcon color="red" variant="subtle" onClick={() => {
                const newMachines = [...machines];
                newMachines.splice(index, 1);
                setMachines(newMachines);
              }}>
                <Trash2 size={16} />
              </ActionIcon>
            </Group>
          ))}
        </div>

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={closeModal}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!name.trim()}
          >
            {editingId ? 'Update' : 'Create'}
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
