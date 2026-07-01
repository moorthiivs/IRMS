import { NavLink as RouterLink, useLocation } from 'react-router-dom';
import { NavLink, Stack } from '@mantine/core';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  FileText, 
  Database, 
  Settings,
  Users,
  Save
} from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const links = [
    { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
    { icon: ClipboardCheck, label: 'Inspection Entry', to: '/inspection' },
    { icon: Save, label: 'Drafts', to: '/drafts' },
    { icon: FileText, label: 'Reports', to: '/reports' },
    ...(isAdmin ? [
      { icon: Database, label: 'Master Data', to: '/master-data' },
      { icon: Users, label: 'Users', to: '/users' },
      { icon: Settings, label: 'Settings', to: '/settings' },
    ] : []),
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
