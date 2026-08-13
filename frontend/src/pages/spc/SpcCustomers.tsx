import { useState } from 'react';
import {
  Title, Paper, Table, Group, Badge, ActionIcon, Button, Text, TextInput, Modal, Tooltip, Skeleton
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2, Package, Cpu } from 'lucide-react';
import { masterDataService } from '../../services/master-data.service';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useAuthStore } from '../../store/auth-store';
import { MachineManagerModal } from '../../components/MachineManagerModal';

export function SpcCustomers() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  
  const [machineManagerOpened, setMachineManagerOpened] = useState(false);
  const [selectedCustomerForMachines, setSelectedCustomerForMachines] = useState<any>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['spc-customers'],
    queryFn: masterDataService.getCustomers,
  });

  const createMutation = useMutation({
    mutationFn: () => masterDataService.createCustomer(name, code || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spc-customers'] });
      notifications.show({ title: 'Created', message: 'SPC Customer created successfully.', color: 'green' });
      closeModal();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to create customer.', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => masterDataService.updateCustomer(editingId!, name, code || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spc-customers'] });
      notifications.show({ title: 'Updated', message: 'SPC Customer updated successfully.', color: 'green' });
      closeModal();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to update customer.', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: masterDataService.deleteCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spc-customers'] });
      notifications.show({ title: 'Deleted', message: 'SPC Customer deleted successfully.', color: 'green' });
    },
  });

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setModalOpened(true);
  };

  const openEditModal = (customer: any) => {
    setEditingId(customer.id);
    setName(customer.name);
    setCode(customer.code || '');
    setModalOpened(true);
  };

  const closeModal = () => {
    setModalOpened(false);
    setEditingId(null);
    setName('');
    setCode('');
  };

  const confirmDelete = (customer: any) => {
    modals.openConfirmModal({
      title: 'Delete Customer',
      children: (
        <Text size="sm">
          Are you sure you want to delete customer <strong>{customer.name}</strong>?
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(customer.id),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="flex items-center gap-2">
            <Building2 className="text-blue-600" size={28} />
            SPC Customers Management
          </Title>
          <Text size="sm" c="dimmed">
            Manage clients and machine allocations for Statistical Process Control (SPC)
          </Text>
        </div>
        {isAdmin && (
          <Button leftSection={<Plus size={16} />} color="blue" onClick={openCreateModal}>
            Add Customer
          </Button>
        )}
      </div>

      <Paper shadow="sm" radius="md" withBorder className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton height={30} />
            <Skeleton height={30} />
            <Skeleton height={30} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table verticalSpacing="sm" striped highlightOnHover style={{ minWidth: 700 }}>
              <Table.Thead className="bg-gray-50 dark:bg-[#25262b]">
                <Table.Tr>
                  <Table.Th>Customer Name</Table.Th>
                  <Table.Th>Code</Table.Th>
                  <Table.Th>Assigned Parts</Table.Th>
                  <Table.Th>Configured Machines</Table.Th>
                  {isAdmin && <Table.Th style={{ width: 150 }}>Actions</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {customers.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={isAdmin ? 5 : 4}>
                      <Text c="dimmed" ta="center" py="xl">
                        No customers configured yet.
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  customers.map((customer: any) => (
                    <Table.Tr key={customer.id}>
                      <Table.Td>
                        <Text fw={600}>{customer.name}</Text>
                      </Table.Td>
                      <Table.Td>
                        {customer.code ? (
                          <Badge variant="light" color="indigo">{customer.code}</Badge>
                        ) : (
                          <Text size="xs" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          <Package size={14} className="text-gray-400" />
                          <Text size="sm">{customer.partCount ?? customer._count?.parts ?? customer.parts?.length ?? 0} Parts</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          <Cpu size={14} className="text-gray-400" />
                          <Text size="sm">{customer.machines?.length || 0} Machines</Text>
                          {isAdmin && (
                            <Button 
                              size="xs" 
                              variant="subtle" 
                              color="blue"
                              onClick={() => {
                                setSelectedCustomerForMachines(customer);
                                setMachineManagerOpened(true);
                              }}
                            >
                              Manage
                            </Button>
                          )}
                        </Group>
                      </Table.Td>
                      {isAdmin && (
                        <Table.Td>
                          <Group gap={6}>
                            <Tooltip label="Edit Customer">
                              <ActionIcon variant="light" color="blue" onClick={() => openEditModal(customer)}>
                                <Pencil size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete Customer">
                              <ActionIcon variant="light" color="red" onClick={() => confirmDelete(customer)}>
                                <Trash2 size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Paper>

      {/* Add / Edit Customer Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingId ? 'Edit SPC Customer' : 'Add New SPC Customer'}
        centered
      >
        <div className="space-y-4">
          <TextInput
            label="Customer Name"
            placeholder="e.g. ACME Quality Components"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextInput
            label="Customer Code"
            placeholder="e.g. ACME-01 (Optional)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button
              color="blue"
              onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!name.trim()}
            >
              {editingId ? 'Save Changes' : 'Create Customer'}
            </Button>
          </Group>
        </div>
      </Modal>

      {/* Machine Manager Modal */}
      {selectedCustomerForMachines && (
        <MachineManagerModal
          opened={machineManagerOpened}
          onClose={() => {
            setMachineManagerOpened(false);
            setSelectedCustomerForMachines(null);
          }}
          customer={selectedCustomerForMachines}
        />
      )}
    </div>
  );
}
