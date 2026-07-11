import { NavLink as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { NavLink, Stack, SegmentedControl, Select, MultiSelect, Divider } from '@mantine/core';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  FileText, 
  Database, 
  Settings,
  Users,
  Save,
  Building2,
  Cpu
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { masterDataService } from '../../services/master-data.service';
import { useState, useEffect } from 'react';

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const { user, appMode, setAppMode, selectedCustomerId, setSelectedCustomerId } = useAuthStore();
  const [activeMachines, setActiveMachines] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const isAdmin = user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const selectedCustomer = customers.find((c: any) => c.id === selectedCustomerId);
  const allMachines: string[] = selectedCustomer?.machines || [];

  useEffect(() => {
    setActiveMachines(selectedCustomer?.activeMachines || []);
  }, [selectedCustomer]);

  const inspectionLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: ClipboardCheck, label: 'Quality Control', to: '/inspection' },
    { icon: Save, label: 'Work in Progress', to: '/drafts' },
    { icon: FileText, label: 'Analytics & Reports', to: '/reports' },
  ];

  const pokaYokeLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: ClipboardCheck, label: 'Poka-Yoke Operations', to: '/pokayoke/entry' },
    { icon: Save, label: 'Work in Progress', to: '/drafts' },
    { icon: FileText, label: 'Poka-Yoke Analytics', to: '/pokayoke/reports' },
  ];

  const adminLinks = [];
  if (isAdmin) {
    adminLinks.push({ icon: Building2, label: 'Client Management', to: '/customers' });
  }
  if (isAdmin || isSupervisor) {
    adminLinks.push({ icon: Database, label: 'Master Data Management', to: '/master-data' });
  }
  if (isAdmin) {
    adminLinks.push({ icon: Users, label: 'Access Control', to: '/users' });
    adminLinks.push({ icon: Settings, label: 'System Configuration', to: '/settings' });
  }

  const links = [
    ...(appMode === 'POKAYOKE' ? pokaYokeLinks : inspectionLinks),
    ...adminLinks,
  ];

  const navigate = useNavigate();

  return (
    <Stack gap="xs">
      <SegmentedControl
        value={appMode}
        onChange={(val) => {
          setAppMode(val as 'INSPECTION' | 'POKAYOKE');
          navigate('/dashboard');
          if (onClose) onClose();
        }}
        data={[
          { label: 'Inspection', value: 'INSPECTION' },
          { label: 'Poka Yoke', value: 'POKAYOKE' },
        ]}
        className="md:hidden mb-2"
        fullWidth
      />

      {/* Mobile Customer/Machine Selector */}
      <div className="md:hidden">
        <Select
          placeholder="Select Customer"
          data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
          value={selectedCustomerId}
          onChange={(val) => {
            setSelectedCustomerId(val);
          }}
          size="xs"
          clearable={isAdmin}
          disabled={!isAdmin && !!user?.customerId}
          leftSection={<Building2 size={14} />}
          mb="xs"
        />
        {selectedCustomerId && allMachines.length > 0 && (
          <MultiSelect
            placeholder="Active Machines"
            data={allMachines.map(m => ({ value: m, label: m }))}
            value={activeMachines}
            onChange={(machines) => {
              setActiveMachines(machines);
              if (selectedCustomerId) {
                masterDataService.updateCustomerActiveMachines(selectedCustomerId, machines)
                  .then(() => queryClient.invalidateQueries({ queryKey: ['customers'] }))
                  .catch(console.error);
              }
            }}
            size="xs"
            leftSection={<Cpu size={14} />}
            maxDropdownHeight={200}
            searchable
            hidePickedOptions
            mb="xs"
          />
        )}
        <Divider mb="xs" />
      </div>

      {links.map((link) => (
        <RouterLink key={link.label} to={link.to} style={{ textDecoration: 'none' }} onClick={onClose}>
          <NavLink
            component="div"
            label={link.label}
            leftSection={<link.icon size={18} strokeWidth={2} />}
            active={location.pathname === link.to}
            variant="filled"
            color="indigo"
            className="rounded-md"
          />
        </RouterLink>
      ))}
    </Stack>
  );
}
