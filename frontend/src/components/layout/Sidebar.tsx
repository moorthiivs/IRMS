import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import { NavLink, Stack } from '@mantine/core';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  FileText, 
  Database, 
  Settings,
  Users,
  Save,
  Building2
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const { user, appMode } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';

  const inspectionLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: ClipboardCheck, label: 'Inspection Entry', to: '/inspection' },
    { icon: Save, label: 'Drafts', to: '/drafts' },
    { icon: FileText, label: 'Reports', to: '/reports' },
  ];

  const pokaYokeLinks = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: ClipboardCheck, label: 'Poka Yoke Entry', to: '/pokayoke/entry' },
    { icon: Save, label: 'Drafts', to: '/drafts' },
    { icon: FileText, label: 'Poka Yoke Reports', to: '/pokayoke/reports' },
  ];

  const adminLinks = [];
  if (isAdmin) {
    adminLinks.push({ icon: Building2, label: 'Customers', to: '/customers' });
  }
  if (isAdmin || isSupervisor) {
    adminLinks.push({ icon: Database, label: 'Master Data', to: '/master-data' });
  }
  if (isAdmin) {
    adminLinks.push({ icon: Users, label: 'Users', to: '/users' });
    adminLinks.push({ icon: Settings, label: 'Settings', to: '/settings' });
  }

  const links = [
    ...(appMode === 'POKAYOKE' ? pokaYokeLinks : inspectionLinks),
    ...adminLinks,
  ];


  return (
    <Stack gap="xs">
      {links.map((link) => (
        <RouterLink key={link.label} to={link.to} style={{ textDecoration: 'none' }} onClick={onClose}>
          <NavLink
            component="div"
            label={link.label}
            leftSection={<link.icon size={18} strokeWidth={2} />}
            active={location.pathname === link.to}
            variant="filled"
            color="blue"
            className="rounded-md"
          />
        </RouterLink>
      ))}
    </Stack>
  );
}
