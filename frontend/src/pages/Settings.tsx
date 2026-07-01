import { useState, useEffect } from 'react';
import {
  Title, Paper, Group, Text, Switch, Stack, Badge,
  Divider, Card, Alert, Loader,
} from '@mantine/core';
import { Settings as SettingsIcon, ShieldAlert, Trash2, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services/settings.service';
import { notifications } from '@mantine/notifications';

export function Settings() {
  const queryClient = useQueryClient();

  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
  });

  const [cascadeDelete, setCascadeDelete] = useState(false);

  useEffect(() => {
    setCascadeDelete(settings.deletion_policy === 'cascade');
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

          <Paper withBorder p="md" radius="md" bg="gray.0">
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
      </Stack>
    </div>
  );
}
