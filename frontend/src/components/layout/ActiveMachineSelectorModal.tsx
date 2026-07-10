import { useState, useMemo } from 'react';
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
  Badge
} from '@mantine/core';
import { Search, X } from 'lucide-react';

interface ActiveMachineSelectorModalProps {
  opened: boolean;
  onClose: () => void;
  allMachines: string[];
  activeMachines: string[];
  setActiveMachines: (machines: string[]) => void;
  customerName?: string;
}

export function ActiveMachineSelectorModal({ 
  opened, 
  onClose, 
  allMachines, 
  activeMachines, 
  setActiveMachines,
  customerName
}: ActiveMachineSelectorModalProps) {
  const [search, setSearch] = useState('');

  const filteredMachines = useMemo(() => {
    return allMachines.filter(m => m.toLowerCase().includes(search.toLowerCase()));
  }, [allMachines, search]);

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
          {customerName && <Badge color="blue" variant="light">{customerName}</Badge>}
        </Group>
      }
      size="xl"
      centered
    >
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

      <Paper withBorder p="md" mb="md" bg="gray.0" className="dark:bg-[#1a1b1e]">
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

      <Group justify="flex-end">
        <Button onClick={onClose} color="blue">
          Done
        </Button>
      </Group>
    </Modal>
  );
}
