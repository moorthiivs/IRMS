import { useState, useMemo, useEffect } from 'react';
import { 
  Modal, 
  Button, 
  Group, 
  TextInput, 
  Text, 
  Paper, 
  ScrollArea, 
  Checkbox,
  SimpleGrid,
  Divider,
  Select
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { Search, X, Building2, CalendarClock } from 'lucide-react';

interface ActiveMachineSelectorModalProps {
  opened: boolean;
  onClose: () => void;
  allMachines: string[];
  activeMachines: string[];
  setActiveMachines: (machines: string[]) => void;
  activeMachinesDate: Date | null;
  setActiveMachinesDate: (d: Date | null) => void;
  customers: any[];
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  isAdmin: boolean;
}

export function ActiveMachineSelectorModal({ 
  opened, 
  onClose, 
  allMachines, 
  activeMachines, 
  setActiveMachines,
  activeMachinesDate,
  setActiveMachinesDate,
  customers,
  selectedCustomerId,
  setSelectedCustomerId,
  isAdmin
}: ActiveMachineSelectorModalProps) {
  const [search, setSearch] = useState('');

  const filteredMachines = useMemo(() => {
    return allMachines.filter(m => m.toLowerCase().includes(search.toLowerCase()));
  }, [allMachines, search]);

  useEffect(() => {
    if (opened && !activeMachinesDate && selectedCustomerId) {
      const d = new Date();
      if (d.getHours() < 9) {
        d.setDate(d.getDate() - 1);
      }
      d.setHours(9, 0, 0, 0);
      setActiveMachinesDate(d);
    }
  }, [opened, activeMachinesDate, selectedCustomerId, setActiveMachinesDate]);

  const allFilteredSelected = filteredMachines.length > 0 && filteredMachines.every(m => activeMachines.includes(m));
  const someFilteredSelected = filteredMachines.some(m => activeMachines.includes(m));

  const handleToggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      // Deselect all filtered
      const newActive = activeMachines.filter(m => !filteredMachines.includes(m));
      setActiveMachines(newActive);
    } else {
      // Select all filtered
      const newActive = [...new Set([...activeMachines, ...filteredMachines])];
      setActiveMachines(newActive);
    }
  };

  const handleToggleMachine = (machine: string) => {
    if (activeMachines.includes(machine)) {
      setActiveMachines(activeMachines.filter(m => m !== machine));
    } else {
      setActiveMachines([...activeMachines, machine]);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={600} size="lg">Select Active Machines</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <Group grow mb="lg" align="flex-start">
        <Select
          label="1. Select Customer"
          placeholder="Select a customer first"
          data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
          value={selectedCustomerId}
          onChange={(val) => {
            setSelectedCustomerId(val);
            setActiveMachines([]);
          }}
          size="sm"
          clearable={isAdmin}
          disabled={!isAdmin && !!selectedCustomerId}
          leftSection={<Building2 size={16} />}
        />
        
        <DateTimePicker
          label="2. Effective Date & Time"
          placeholder="Pick date and time"
          value={activeMachinesDate}
          onChange={setActiveMachinesDate}
          disabled={!selectedCustomerId || !isAdmin}
          clearable={false}
          size="sm"
          leftSection={<CalendarClock size={16} />}
        />
      </Group>

      {selectedCustomerId ? (
        <>
          <Group justify="space-between" mb="md">
            <TextInput
          placeholder="Search machines..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftSection={<Search size={16} />}
          style={{ flex: 1 }}
        />
        <Button 
          variant="light" 
          color="gray"
          leftSection={<X size={16} />}
          onClick={() => {
            setSearch('');
            setActiveMachines([]);
          }}
        >
          Clear All Selected
        </Button>
      </Group>

      <Paper withBorder p="md" mb="md" className="dark:bg-[#1a1b1e]">
        <Group justify="space-between" mb="md">
          <Checkbox 
            label={`Select All (${filteredMachines.length})`}
            checked={allFilteredSelected}
            indeterminate={someFilteredSelected && !allFilteredSelected}
            onChange={handleToggleSelectAllFiltered}
            fw={500}
          />
          <Text size="sm" c="dimmed">
            {activeMachines.filter(m => allMachines.includes(m)).length} selected out of {allMachines.length}
          </Text>
        </Group>

        <Divider mb="md" />

        <ScrollArea h={400} type="always" offsetScrollbars>
          {filteredMachines.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">No machines found.</Text>
          ) : (
            <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm">
              {filteredMachines.map(mc => (
                <Paper 
                  key={mc} 
                  withBorder 
                  p="xs" 
                  className={`cursor-pointer transition-colors ${
                    activeMachines.includes(mc) 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                      : 'hover:bg-gray-50 dark:hover:bg-[#25262b]'
                  }`}
                  onClick={() => handleToggleMachine(mc)}
                >
                  <Checkbox 
                    label={mc}
                    checked={activeMachines.includes(mc)}
                    onChange={() => {}} // handled by parent Paper click
                    style={{ pointerEvents: 'none' }}
                  />
                </Paper>
              ))}
            </SimpleGrid>
          )}
        </ScrollArea>
      </Paper>
      </>
      ) : (
        <Text c="dimmed" ta="center" py="xl">Please select a customer to view machines.</Text>
      )}

      <Group justify="flex-end">
        <Button onClick={onClose} color="blue">
          Done
        </Button>
      </Group>
    </Modal>
  );
}
