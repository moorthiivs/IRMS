import { useState, useEffect } from 'react';
import { 
  Modal, 
  Button, 
  Group, 
  TextInput, 
  ActionIcon, 
  Text, 
  Paper, 
  ScrollArea, 
  Badge,
  FileButton,
  Divider,
  Alert
} from '@mantine/core';
import { Trash2, Plus, Upload, Cpu, Info } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '../services/master-data.service';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';

interface MachineManagerModalProps {
  opened: boolean;
  onClose: () => void;
  customer: any;
}

export function MachineManagerModal({ opened, onClose, customer }: MachineManagerModalProps) {
  const queryClient = useQueryClient();
  const [machines, setMachines] = useState<string[]>([]);
  const [newMachine, setNewMachine] = useState('');
  const [search, setSearch] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (opened && customer) {
      setMachines([...(customer.machines || [])]);
      setNewMachine('');
      setSearch('');
    }
  }, [opened, customer]);

  const updateMutation = useMutation({
    mutationFn: (updatedMachines: string[]) => 
      masterDataService.updateCustomer(customer.id, customer.name, customer.code || undefined, updatedMachines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      notifications.show({ title: 'Success', message: 'Machines updated successfully', color: 'green' });
      onClose();
    },
    onError: (err: any) => {
      notifications.show({ 
        title: 'Error', 
        message: err?.response?.data?.message || 'Failed to update machines.', 
        color: 'red' 
      });
    },
  });

  const handleAddManual = () => {
    const val = newMachine.trim();
    if (val && !machines.includes(val)) {
      setMachines([...machines, val]);
      setNewMachine('');
    } else if (machines.includes(val)) {
      notifications.show({ title: 'Duplicate', message: 'Machine already exists', color: 'yellow' });
    }
  };

  const handleRemove = (machineToRemove: string) => {
    setMachines(machines.filter(m => m !== machineToRemove));
  };

  const handleFileUpload = (file: File | null) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Read as 2D array
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const uploadedMachines: string[] = [];
        
        json.forEach((row: any) => {
          if (row && row.length > 0) {
            const val = String(row[0]).trim();
            // Skip common headers
            if (val && !['machine', 'machine number', 'm/c no', 'mc no'].includes(val.toLowerCase())) {
              uploadedMachines.push(val);
            }
          }
        });

        if (uploadedMachines.length > 0) {
          const newUniqueMachines = [...new Set([...machines, ...uploadedMachines])];
          setMachines(newUniqueMachines);
          notifications.show({ 
            title: 'Upload Success', 
            message: `Added ${uploadedMachines.length} machines from file.`, 
            color: 'green' 
          });
        } else {
          notifications.show({ 
            title: 'No Data', 
            message: 'Could not find any machine numbers in the first column.', 
            color: 'yellow' 
          });
        }
      } catch (err) {
        console.error(err);
        notifications.show({ title: 'Error', message: 'Failed to parse Excel file', color: 'red' });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSave = () => {
    updateMutation.mutate(machines);
  };

  const filteredMachines = machines.filter(m => m.toLowerCase().includes(search.toLowerCase()));

  if (!customer) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Cpu size={20} className="text-blue-600" />
          <Text fw={600} size="lg">Manage Machines - {customer.name}</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Alert icon={<Info size={16} />} title="Bulk Upload Guide" color="blue" variant="light" mb="md">
        To upload multiple machines at once, prepare an Excel file with all machine numbers listed in the <strong>first column (Column A)</strong>.
      </Alert>

      <Group justify="space-between" align="flex-end" mb="md">
        <Group>
          <TextInput
            placeholder="Add a machine manually..."
            value={newMachine}
            onChange={(e) => setNewMachine(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
            style={{ width: 250 }}
          />
          <Button variant="light" leftSection={<Plus size={16} />} onClick={handleAddManual} disabled={!newMachine.trim()}>
            Add
          </Button>
        </Group>

        <FileButton onChange={handleFileUpload} accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel">
          {(props) => (
            <Button {...props} color="teal" variant="light" leftSection={<Upload size={16} />}>
              Upload Excel
            </Button>
          )}
        </FileButton>
      </Group>

      <Divider my="md" />

      <Group justify="space-between" mb="sm">
        <Text fw={500}>Machine List <Badge color="blue" ml="xs">{machines.length}</Badge></Text>
        <TextInput 
          placeholder="Search machines..." 
          size="xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200 }}
        />
      </Group>

      <Paper withBorder bg="gray.0" className="dark:bg-[#1a1b1e]">
        <ScrollArea h={300} type="always">
          {filteredMachines.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">
              {search ? 'No machines match your search.' : 'No machines linked yet.'}
            </Text>
          ) : (
            <div className="p-2 space-y-1">
              {filteredMachines.map(mc => (
                <Paper key={mc} withBorder p="xs" className="flex items-center justify-between hover:bg-white dark:hover:bg-[#25262b] transition-colors">
                  <Text size="sm" fw={500}>{mc}</Text>
                  <ActionIcon color="red" variant="subtle" onClick={() => handleRemove(mc)}>
                    <Trash2 size={16} />
                  </ActionIcon>
                </Paper>
              ))}
            </div>
          )}
        </ScrollArea>
      </Paper>

      <Group justify="flex-end" mt="xl">
        <Button variant="default" onClick={onClose} disabled={updateMutation.isPending}>Cancel</Button>
        <Button onClick={handleSave} loading={updateMutation.isPending} color="blue">
          Save Changes
        </Button>
      </Group>
    </Modal>
  );
}
