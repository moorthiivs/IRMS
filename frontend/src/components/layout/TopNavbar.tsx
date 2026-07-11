import { Group, Badge, Tooltip, Button } from '@mantine/core';
import { Clock, HardDrive, Cpu } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '../../services/master-data.service';
import { ActiveMachineSelectorModal } from './ActiveMachineSelectorModal';

export function TopNavbar() {
  const { activeShift, machineNumber, user, selectedCustomerId, setSelectedCustomerId } = useAuthStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [machineSelectorOpened, setMachineSelectorOpened] = useState(false);
  const [activeMachines, setActiveMachines] = useState<string[]>([]);
  const [activeMachinesDate, setActiveMachinesDate] = useState<Date | null>(null);
  const queryClient = useQueryClient();


  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const isAdmin = user?.role === 'ADMIN';

  // For non-admin users, auto-select their assigned customer
  useEffect(() => {
    if (!isAdmin && user?.customerId && !selectedCustomerId) {
      setSelectedCustomerId(user.customerId);
    }
  }, [user, isAdmin, selectedCustomerId]);

  // Get machines for the selected customer
  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);
  const allMachines: string[] = selectedCustomer?.machines || [];

  useEffect(() => {
    setActiveMachines(selectedCustomer?.activeMachines || []);
    setActiveMachinesDate(selectedCustomer?.activeMachinesDate ? new Date(selectedCustomer.activeMachinesDate) : null);
  }, [selectedCustomer]);

  return (
    <Group gap="sm" className="hidden md:flex">
      {/* Active Machines Selector */}
      <Button
        variant="light"
        color="teal"
        size="xs"
        leftSection={<Cpu size={14} />}
        onClick={() => setMachineSelectorOpened(true)}
      >
        {(selectedCustomerId && activeMachines.length > 0) 
          ? `M/C: ${activeMachines.filter(m => allMachines.includes(m)).length}/${allMachines.length} Selected` 
          : 'Select Machine'}
      </Button>
      
      <ActiveMachineSelectorModal 
        opened={machineSelectorOpened}
        onClose={() => {
          setMachineSelectorOpened(false);
          if (selectedCustomerId) {
            masterDataService.updateCustomerActiveMachines(selectedCustomerId, activeMachines, activeMachinesDate?.toISOString())
              .then(() => queryClient.invalidateQueries({ queryKey: ['customers'] }))
              .catch(console.error);
          }
        }}
        allMachines={allMachines}
        activeMachines={activeMachines}
        setActiveMachines={setActiveMachines}
        activeMachinesDate={activeMachinesDate}
        setActiveMachinesDate={setActiveMachinesDate}
        customers={customers}
        selectedCustomerId={selectedCustomerId}
        setSelectedCustomerId={setSelectedCustomerId}
        isAdmin={isAdmin}
      />



      {activeShift && (
        <Tooltip label="Active Shift">
          <Badge 
            variant="light" 
            color="blue" 
            size="lg" 
            leftSection={<Clock size={12} />}
          >
            {activeShift.name}
          </Badge>
        </Tooltip>
      )}
      
      {machineNumber && (
        <Tooltip label="Machine Number">
          <Badge 
            variant="light" 
            color="cyan" 
            size="lg" 
            leftSection={<HardDrive size={12} />}
          >
            {machineNumber}
          </Badge>
        </Tooltip>
      )}

      <Tooltip label={isOnline ? "Online" : "Offline Mode (Saving locally)"}>
        <Badge 
          variant="dot" 
          color={isOnline ? "green" : "red"} 
          size="lg"
        >
          {isOnline ? 'Online' : 'Offline'}
        </Badge>
      </Tooltip>
    </Group>
  );
}
