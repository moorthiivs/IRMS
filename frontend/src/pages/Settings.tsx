import { useState, useEffect } from 'react';
import {
  Title, Paper, Group, Text, Switch, Stack, Badge,
  Divider, Card, Alert, Loader, Button, SegmentedControl, useMantineColorScheme, useComputedColorScheme, ActionIcon
} from '@mantine/core';
import { Capacitor } from '@capacitor/core';
import { Settings as SettingsIcon, ShieldAlert, Trash2, Info, Hash, Sun, Moon, Monitor } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services/settings.service';
import { notifications } from '@mantine/notifications';

export function Settings() {
  const queryClient = useQueryClient();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  const formatVersion = (v: string | null) => {
    if (!v || v === 'built-in') return 'v1.0.0 (Built-in)';
    if (v.length >= 40) return `v1.0.0-${v.substring(0, 7)}`;
    return v;
  };

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
  });

  const [cascadeDelete, setCascadeDelete] = useState(false);
  const [lotNumberRequired, setLotNumberRequired] = useState(true);

  // OTA Update states
  const [currentVersion, setCurrentVersion] = useState<string>('built-in');
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      setCurrentVersion(localStorage.getItem('app_version') || 'built-in');
      checkVersion();
    } else {
      setCurrentVersion(import.meta.env.VITE_APP_VERSION || 'built-in');
    }
  }, []);

  const checkVersion = async () => {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      let origin = '';
      try {
        const urlObj = new URL(baseUrl);
        origin = urlObj.origin;
      } catch (e) {
        origin = 'https://irms-gzasfnghh6g2b3hu.centralindia-01.azurewebsites.net';
      }

      const res = await fetch(`${origin}/version.json?t=${Date.now()}`);
      if (!res.ok) return;
      
      const data = await res.json();
      const version = data.version;
      const localVersion = localStorage.getItem('app_version') || 'built-in';

      if (version && version !== localVersion) {
        setRemoteVersion(version);
        setHasUpdate(true);
      }
    } catch (error) {
      console.error('Failed to check remote version:', error);
    }
  };

  const handleManualUpdate = async () => {
    window.dispatchEvent(new CustomEvent('force-ota-update'));
  };

  useEffect(() => {
    setCascadeDelete(settings.deletion_policy === 'cascade');
    setLotNumberRequired(settings.lot_number_required !== 'false');
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsService.update(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      notifications.show({
        title: 'Setting Updated',
        message: 'Your setting has been saved.',
        color: 'green',
      });
    },
  });

  const handleToggle = (checked: boolean) => {
    setCascadeDelete(checked);
    updateMutation.mutate({
      key: 'deletion_policy',
      value: checked ? 'cascade' : 'strict',
    });
  };

  const handleLotNumberToggle = (checked: boolean) => {
    setLotNumberRequired(checked);
    updateMutation.mutate({
      key: 'lot_number_required',
      value: checked ? 'true' : 'false',
    });
  };

  if (isLoading) {
    return (
      <Group justify="center" mt="xl">
        <Loader />
      </Group>
    );
  }

  return (
    <div>
      <Group mb="lg" gap="sm">
        <SettingsIcon size={28} />
        <Title order={2}>Settings</Title>
      </Group>

      <Stack gap="lg">
        {/* Appearance Configuration */}
        <Card withBorder radius="md" p="lg">
          <Group mb="md" gap="sm">
            <Sun size={20} />
            <Text fw={600} size="lg">
              Appearance
            </Text>
          </Group>

          <Divider mb="md" />

          <Text size="sm" c="dimmed" mb="md">
            Customize the look and feel of the application. Select between light, dark, or system default mode.
          </Text>

          <Paper withBorder p="md" radius="md" bg="var(--mantine-color-gray-0)" darkHidden>
            <Group justify="space-between" align="center">
              <div>
                <Text fw={600} size="sm">Theme Preference</Text>
                <Text size="xs" c="dimmed">Currently using {computedColorScheme} mode</Text>
              </div>
              <SegmentedControl
                value={colorScheme}
                onChange={(value: any) => setColorScheme(value)}
                data={[
                  { label: <Group gap="xs" wrap="nowrap" justify="center"><Sun size={16} /> Light</Group>, value: 'light' },
                  { label: <Group gap="xs" wrap="nowrap" justify="center"><Moon size={16} /> Dark</Group>, value: 'dark' },
                  { label: <Group gap="xs" wrap="nowrap" justify="center"><Monitor size={16} /> Auto</Group>, value: 'auto' },
                ]}
              />
            </Group>
          </Paper>
          
          <Paper withBorder p="md" radius="md" bg="var(--mantine-color-dark-6)" lightHidden>
            <Group justify="space-between" align="center">
              <div>
                <Text fw={600} size="sm">Theme Preference</Text>
                <Text size="xs" c="dimmed">Currently using {computedColorScheme} mode</Text>
              </div>
              <SegmentedControl
                value={colorScheme}
                onChange={(value: any) => setColorScheme(value)}
                data={[
                  { label: <Group gap="xs" wrap="nowrap" justify="center"><Sun size={16} /> Light</Group>, value: 'light' },
                  { label: <Group gap="xs" wrap="nowrap" justify="center"><Moon size={16} /> Dark</Group>, value: 'dark' },
                  { label: <Group gap="xs" wrap="nowrap" justify="center"><Monitor size={16} /> Auto</Group>, value: 'auto' },
                ]}
              />
            </Group>
          </Paper>
        </Card>

        {/* Lot Number Configuration */}
        <Card withBorder radius="md" p="lg">
          <Group mb="md" gap="sm">
            <Hash size={20} />
            <Text fw={600} size="lg">
              Lot Number Configuration
            </Text>
            <Badge
              color={lotNumberRequired ? 'blue' : 'gray'}
              variant="light"
              size="sm"
            >
              {lotNumberRequired ? 'Required' : 'Optional'}
            </Badge>
          </Group>

          <Divider mb="md" />

          <Text size="sm" c="dimmed" mb="md">
            Controls whether the Lot Number field is mandatory when submitting an inspection.
          </Text>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <Hash size={16} />
                  <Text fw={600} size="sm">
                    Require Lot Number
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {lotNumberRequired
                    ? 'Inspectors must enter a Lot Number before submitting. This is the default behavior.'
                    : 'Lot Number is optional. Inspectors can submit without entering a Lot Number.'}
                </Text>
              </div>
              <Switch
                checked={lotNumberRequired}
                onChange={(e) => handleLotNumberToggle(e.currentTarget.checked)}
                color="blue"
                size="md"
              />
            </Group>
          </Paper>
        </Card>

        {/* Deletion Policy */}
        <Card withBorder radius="md" p="lg">
          <Group mb="md" gap="sm">
            <Trash2 size={20} />
            <Text fw={600} size="lg">
              Data Deletion Policy
            </Text>
            <Badge
              color={cascadeDelete ? 'red' : 'blue'}
              variant="light"
              size="sm"
            >
              {cascadeDelete ? 'Cascade' : 'Strict'}
            </Badge>
          </Group>

          <Divider mb="md" />

          <Text size="sm" c="dimmed" mb="md">
            This controls how the system handles deleting Parts or Operations that already
            have associated inspection history (transactions).
          </Text>

          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="flex-start">
              <div style={{ flex: 1 }}>
                <Group gap="xs" mb={4}>
                  <ShieldAlert size={16} />
                  <Text fw={600} size="sm">
                    Allow Cascade Delete
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {cascadeDelete
                    ? 'Deleting a Part or Operation will also delete ALL associated inspection records. This action is irreversible.'
                    : 'Deletion is blocked if the Part or Operation has any inspection history. You must remove the inspection data first.'}
                </Text>
              </div>
              <Switch
                checked={cascadeDelete}
                onChange={(e) => handleToggle(e.currentTarget.checked)}
                color="red"
                size="md"
              />
            </Group>
          </Paper>

          {cascadeDelete && (
            <Alert
              icon={<Info size={16} />}
              title="Warning"
              color="red"
              variant="light"
              mt="md"
            >
              Cascade delete is enabled. Deleting a Part or Operation from Master Data
              will permanently remove all associated inspection transactions and reports.
            </Alert>
          )}
        </Card>
        {/* App Version Info */}
        <Card withBorder radius="md" p="lg">
          <Group mb="md" gap="sm">
            <Info size={20} />
            <Text fw={600} size="lg">
              App Version
            </Text>
          </Group>

          <Divider mb="md" />
          
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" align="center">
              <div>
                <Text fw={600} size="sm">
                  Current Version
                </Text>
                <Text size="xs" c="dimmed">
                  {formatVersion(currentVersion)}
                </Text>
              </div>
              
              {isNative && hasUpdate && (
                <Button 
                  size="xs" 
                  color="blue" 
                  onClick={handleManualUpdate}
                >
                  Update Available ({formatVersion(remoteVersion)})
                </Button>
              )}
            </Group>
          </Paper>
        </Card>
      </Stack>
    </div>
  );
}
