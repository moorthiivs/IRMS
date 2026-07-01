import { Group, Badge, Tooltip } from '@mantine/core';
import { Clock, HardDrive } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { useEffect, useState } from 'react';

export function TopNavbar() {
  const { activeShift, machineNumber } = useAuthStore();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  return (
    <Group gap="sm" className="hidden md:flex">
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
