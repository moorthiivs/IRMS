import { AppShell, Burger, Group, Text, Avatar, Menu, UnstyledButton, ActionIcon, Tooltip, SegmentedControl } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { useAuthStore } from '@/store/auth-store';
import { LogOut, User as UserIcon, PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';
import { useMantineColorScheme } from '@mantine/core';

export function DashboardLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure();
  const [desktopCollapsed, { toggle: toggleDesktop }] = useDisclosure(false);
  const { user, logout, appMode, setAppMode } = useAuthStore();
  const { toggleColorScheme, colorScheme } = useMantineColorScheme();

  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened, desktop: desktopCollapsed },
      }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={mobileOpened} onClick={toggleMobile} hiddenFrom="sm" size="sm" />
            <Tooltip label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={toggleDesktop}
                visibleFrom="sm"
                size="lg"
              >
                {desktopCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
              </ActionIcon>
            </Tooltip>
            <Text size="xl" fw={700} c="blue.6">
              IRMS
            </Text>
            <SegmentedControl
              ml="md"
              value={appMode}
              onChange={(val) => {
                setAppMode(val as 'INSPECTION' | 'POKAYOKE');
                navigate('/dashboard'); // Navigate to a common starting point
              }}
              data={[
                { label: 'Inspection', value: 'INSPECTION' },
                { label: 'Poka Yoke', value: 'POKAYOKE' },
              ]}
              className="hidden md:flex"
            />
          </Group>
          
          <Group>

            <TopNavbar />
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <UnstyledButton>
                  <Group gap={8}>
                    <Avatar color="blue" radius="xl">{user?.name?.charAt(0) || 'U'}</Avatar>
                    <div className="hidden sm:block">
                      <Text size="sm" fw={500}>{user?.name}</Text>
                      <Text size="xs" c="dimmed">{user?.role}</Text>
                    </div>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<UserIcon size={14} />}>
                  Profile
                </Menu.Item>
                <Menu.Item 
                  leftSection={colorScheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                  onClick={() => toggleColorScheme()}
                >
                  {colorScheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item 
                  color="red" 
                  leftSection={<LogOut size={14} />}
                  onClick={handleLogout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Sidebar onClose={() => toggleMobile()} />
      </AppShell.Navbar>

      <AppShell.Main>
        <div className="w-full h-full">
          <Outlet />
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
