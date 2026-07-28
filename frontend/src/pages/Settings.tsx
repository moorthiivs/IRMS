import { useState, useEffect } from 'react';
import {
  Title, Paper, Group, Text, Switch, Stack, Badge,
  Divider, Card, Alert, Loader, Button, SegmentedControl, useMantineColorScheme, useComputedColorScheme,
  TextInput, Modal, Select, Tabs
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Capacitor } from '@capacitor/core';
import { Settings as SettingsIcon, ShieldAlert, Trash2, Info, Hash, Sun, Moon, Monitor, FileText, Mail } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services/settings.service';
import { notifications } from '@mantine/notifications';
import api from '../lib/axios';
import { useAppStore } from '../store/app-store';
import { ReportLogoUploader } from '../components/ReportLogoUploader';

export function Settings() {
  const queryClient = useQueryClient();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const { fontFamily, setFontFamily } = useAppStore();

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

  // Shared Report Header State
  const [reportCompanyName, setReportCompanyName] = useState('');
  const [reportCompanySubtitle, setReportCompanySubtitle] = useState('');
  const [reportLogo, setReportLogo] = useState<string | null>(null);

  // Inspection Report Header State
  const [inspectionReportTitle, setInspectionReportTitle] = useState('INSPECTOR - INPROCESS CHECK SHEET');
  const [inspectionReportRNo, setInspectionReportRNo] = useState('01');
  const [inspectionReportRDate, setInspectionReportRDate] = useState('06.10.2023');
  const [inspectionReportDocNumber, setInspectionReportDocNumber] = useState('TAF / P2 / 9.1B');

  // Poka-Yoke Report Header State
  const [pokayokeReportTitle, setPokayokeReportTitle] = useState('POKA-YOKE INSPECTION REPORT');
  const [pokayokeReportRNo, setPokayokeReportRNo] = useState('03');
  const [pokayokeReportRDate, setPokayokeReportRDate] = useState('23.04.2023');
  const [pokayokeReportDocNumber, setPokayokeReportDocNumber] = useState('TAF/P2/9.4');

  // SMTP Settings state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpEncryption, setSmtpEncryption] = useState('none');

  // Test email modal state
  const [testEmailOpened, { open: openTestEmail, close: closeTestEmail }] = useDisclosure(false);
  const [testEmailTarget, setTestEmailTarget] = useState('');

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
    if (settings.report_company_name !== undefined) setReportCompanyName(settings.report_company_name);
    if (settings.report_company_subtitle !== undefined) setReportCompanySubtitle(settings.report_company_subtitle);
    setReportLogo(settings.report_logo || null);

    // Inspection header settings
    setInspectionReportTitle(settings.inspection_report_title || settings.report_title || 'INSPECTOR - INPROCESS CHECK SHEET');
    setInspectionReportRNo(settings.inspection_report_r_no || settings.report_r_no || '01');
    setInspectionReportRDate(settings.inspection_report_r_date || settings.report_r_date || '06.10.2023');
    setInspectionReportDocNumber(settings.inspection_report_doc_number || settings.report_doc_number || 'TAF / P2 / 9.1B');

    // Poka-Yoke header settings
    setPokayokeReportTitle(settings.pokayoke_report_title || settings.report_title || 'POKA-YOKE INSPECTION REPORT');
    setPokayokeReportRNo(settings.pokayoke_report_r_no || settings.report_r_no || '03');
    setPokayokeReportRDate(settings.pokayoke_report_r_date || settings.report_r_date || '23.04.2023');
    setPokayokeReportDocNumber(settings.pokayoke_report_doc_number || settings.report_doc_number || 'TAF/P2/9.4');

    if (settings.smtp_host) setSmtpHost(settings.smtp_host);
    if (settings.smtp_port) setSmtpPort(settings.smtp_port);
    if (settings.smtp_user) setSmtpUser(settings.smtp_user);
    if (settings.smtp_password) setSmtpPassword(settings.smtp_password);
    if (settings.smtp_encryption) setSmtpEncryption(settings.smtp_encryption);
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsService.update(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post('/notifications/test-email', { email });
      return data;
    },
    onSuccess: () => {
      notifications.show({ title: 'Success', message: 'Test email sent successfully.', color: 'green' });
      closeTestEmail();
      setTestEmailTarget('');
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to send test email.', color: 'red' });
    },
  });

  const triggerAlertsMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/trigger-alerts');
      return data;
    },
    onSuccess: () => {
      notifications.show({ title: 'Success', message: 'Alerts triggered successfully. Check your email.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to trigger alerts.', color: 'red' });
    },
  });

  const handleSaveReportTemplate = () => {
    Promise.all([
      updateMutation.mutateAsync({ key: 'report_company_name', value: reportCompanyName }),
      updateMutation.mutateAsync({ key: 'report_company_subtitle', value: reportCompanySubtitle }),
      updateMutation.mutateAsync({ key: 'report_logo', value: reportLogo || '' }),

      // Save Inspection Report Header Settings
      updateMutation.mutateAsync({ key: 'inspection_report_title', value: inspectionReportTitle }),
      updateMutation.mutateAsync({ key: 'inspection_report_r_no', value: inspectionReportRNo }),
      updateMutation.mutateAsync({ key: 'inspection_report_r_date', value: inspectionReportRDate }),
      updateMutation.mutateAsync({ key: 'inspection_report_doc_number', value: inspectionReportDocNumber }),

      // Save Poka-Yoke Report Header Settings
      updateMutation.mutateAsync({ key: 'pokayoke_report_title', value: pokayokeReportTitle }),
      updateMutation.mutateAsync({ key: 'pokayoke_report_r_no', value: pokayokeReportRNo }),
      updateMutation.mutateAsync({ key: 'pokayoke_report_r_date', value: pokayokeReportRDate }),
      updateMutation.mutateAsync({ key: 'pokayoke_report_doc_number', value: pokayokeReportDocNumber }),

      // Keep legacy keys updated for fallback compatibility
      updateMutation.mutateAsync({ key: 'report_title', value: pokayokeReportTitle }),
      updateMutation.mutateAsync({ key: 'report_r_no', value: pokayokeReportRNo }),
      updateMutation.mutateAsync({ key: 'report_r_date', value: pokayokeReportRDate }),
      updateMutation.mutateAsync({ key: 'report_doc_number', value: pokayokeReportDocNumber }),
    ]).then(() => {
      notifications.show({ title: 'Report Template Saved', message: 'Inspection and Poka-Yoke template settings saved successfully.', color: 'green' });
    }).catch(() => {
      // Error is handled by individual mutation
    });
  };

  const handleSaveSmtp = () => {
    Promise.all([
      updateMutation.mutateAsync({ key: 'smtp_host', value: smtpHost }),
      updateMutation.mutateAsync({ key: 'smtp_port', value: smtpPort }),
      updateMutation.mutateAsync({ key: 'smtp_user', value: smtpUser }),
      updateMutation.mutateAsync({ key: 'smtp_password', value: smtpPassword }),
      updateMutation.mutateAsync({ key: 'smtp_encryption', value: smtpEncryption }),
    ]).then(() => {
      notifications.show({ title: 'SMTP Settings Saved', message: 'All SMTP settings saved successfully.', color: 'green' });
    }).catch(() => {
      // Error is handled by individual mutation
    });
  };

  const handleToggle = (checked: boolean) => {
    setCascadeDelete(checked);
    updateMutation.mutate(
      { key: 'deletion_policy', value: checked ? 'cascade' : 'strict' },
      { onSuccess: () => notifications.show({ title: 'Settings Updated', message: 'The deletion policy has been saved.', color: 'green' }) }
    );
  };

  const handleLotNumberToggle = (checked: boolean) => {
    setLotNumberRequired(checked);
    updateMutation.mutate(
      { key: 'lot_number_required', value: checked ? 'true' : 'false' },
      { onSuccess: () => notifications.show({ title: 'Settings Updated', message: 'The lot number requirement has been saved.', color: 'green' }) }
    );
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

          <Paper withBorder p="md" radius="md" mt="md">
            <Group justify="space-between" align="center">
              <div>
                <Text fw={600} size="sm">Typography Font</Text>
                <Text size="xs" c="dimmed">Select the font family used across the application</Text>
              </div>
              <Select
                data={[
                  { value: 'Inter', label: 'Inter' },
                  { value: 'PlusJakartaSans', label: 'Plus Jakarta Sans' },
                ]}
                value={fontFamily}
                onChange={(val: string | null) => val && setFontFamily(val as 'Inter' | 'PlusJakartaSans')}
                style={{ width: 200 }}
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

          <Paper withBorder={false} p="md" radius="md">
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

          <Paper withBorder={false} p="md" radius="md">
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

        {/* Report Template Configuration */}
        <Card withBorder radius="md" p="lg">
          <Group mb="md" gap="sm">
            <FileText size={20} />
            <Text fw={600} size="lg">
              Report Template Settings
            </Text>
          </Group>

          <Divider mb="md" />

          <Text size="sm" c="dimmed" mb="md">
            Configure header logo, company name, and separate header/control text for Inspection Reports and Poka-Yoke Reports.
          </Text>

          <Stack gap="md">
            <ReportLogoUploader value={reportLogo} onChange={setReportLogo} />
            
            <TextInput
              label="Company Name"
              description="Full company name displayed in the report header for both reports"
              value={reportCompanyName}
              onChange={(e) => setReportCompanyName(e.target.value)}
            />

            <TextInput
              label="Company Subtitle / Division (Optional)"
              description="Optional plant/division subtitle displayed below company name (e.g. AUTOLEC DIVISION PLANT-II)"
              placeholder="(AUTOLEC DIVISION PLANT-II)"
              value={reportCompanySubtitle}
              onChange={(e) => setReportCompanySubtitle(e.target.value)}
            />

            <Tabs defaultValue="inspection" variant="outline" radius="md">
              <Tabs.List mb="md">
                <Tabs.Tab value="inspection">
                  Inspection Report Header
                </Tabs.Tab>
                <Tabs.Tab value="pokayoke">
                  Poka-Yoke Report Header
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="inspection">
                <Stack gap="sm">
                  <TextInput
                    label="Inspection Report Title"
                    description="Title displayed on Inspection Reports"
                    value={inspectionReportTitle}
                    onChange={(e) => setInspectionReportTitle(e.target.value)}
                  />
                  <Group grow>
                    <TextInput
                      label="R.No"
                      description="Revision number"
                      value={inspectionReportRNo}
                      onChange={(e) => setInspectionReportRNo(e.target.value)}
                    />
                    <TextInput
                      label="R.Date"
                      description="Revision date"
                      value={inspectionReportRDate}
                      onChange={(e) => setInspectionReportRDate(e.target.value)}
                    />
                    <TextInput
                      label="Document Control Number"
                      description="e.g. TAF / P2 / 9.1B"
                      value={inspectionReportDocNumber}
                      onChange={(e) => setInspectionReportDocNumber(e.target.value)}
                    />
                  </Group>
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="pokayoke">
                <Stack gap="sm">
                  <TextInput
                    label="Poka-Yoke Report Title"
                    description="Title displayed on Poka-Yoke Reports"
                    value={pokayokeReportTitle}
                    onChange={(e) => setPokayokeReportTitle(e.target.value)}
                  />
                  <Group grow>
                    <TextInput
                      label="R.No"
                      description="Revision number"
                      value={pokayokeReportRNo}
                      onChange={(e) => setPokayokeReportRNo(e.target.value)}
                    />
                    <TextInput
                      label="R.Date"
                      description="Revision date"
                      value={pokayokeReportRDate}
                      onChange={(e) => setPokayokeReportRDate(e.target.value)}
                    />
                    <TextInput
                      label="Document Control Number"
                      description="e.g. TAF/P2/9.4"
                      value={pokayokeReportDocNumber}
                      onChange={(e) => setPokayokeReportDocNumber(e.target.value)}
                    />
                  </Group>
                </Stack>
              </Tabs.Panel>
            </Tabs>

            <Group justify="flex-end" mt="md">
              <Button onClick={handleSaveReportTemplate} loading={updateMutation.isPending}>
                Save Template Settings
              </Button>
            </Group>
          </Stack>
        </Card>

        {/* SMTP Configuration */}
        <Card withBorder radius="md" p="lg">
          <Group mb="md" gap="sm">
            <Mail size={20} />
            <Text fw={600} size="lg">
              SMTP Configuration (Email Alerts)
            </Text>
          </Group>

          <Divider mb="md" />

          <Text size="sm" c="dimmed" mb="md">
            Configure your SMTP server to enable automated email alerts for overdue reports and notifications.
          </Text>

          <Stack gap="sm">
            <Group grow>
              <TextInput
                label="SMTP Host"
                placeholder="smtp.example.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
              />
              <TextInput
                label="SMTP Port"
                placeholder="587"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
              />
            </Group>
            <Group grow>
              <TextInput
                label="SMTP Username"
                placeholder="user@example.com"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
              <TextInput
                label="SMTP Password"
                type="password"
                placeholder="Password or App Password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
              />
            </Group>
            <Select
              label="Encryption"
              data={[
                { value: 'none', label: 'None' },
                { value: 'ssl', label: 'SSL/TLS' },
                { value: 'tls', label: 'STARTTLS' },
              ]}
              value={smtpEncryption}
              onChange={(value) => setSmtpEncryption(value || 'none')}
            />
            <Group justify="space-between" mt="md">
              <Group>
                <Button 
                  variant="light" 
                  onClick={openTestEmail} 
                  loading={testEmailMutation.isPending}
                >
                  Send Test Email
                </Button>
                <Button 
                  variant="outline" 
                  color="orange"
                  onClick={() => triggerAlertsMutation.mutate()} 
                  loading={triggerAlertsMutation.isPending}
                >
                  Trigger Alerts Now
                </Button>
              </Group>
              <Button onClick={handleSaveSmtp} loading={updateMutation.isPending}>
                Save SMTP Settings
              </Button>
            </Group>
          </Stack>
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

      <Modal opened={testEmailOpened} onClose={closeTestEmail} title="Send Test Email" centered>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Enter the email address you want to send a test message to.
          </Text>
          <TextInput
            placeholder="alerts@example.com"
            value={testEmailTarget}
            onChange={(e) => setTestEmailTarget(e.target.value)}
            data-autofocus
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeTestEmail}>Cancel</Button>
            <Button 
              onClick={() => testEmailMutation.mutate(testEmailTarget)} 
              loading={testEmailMutation.isPending}
              disabled={!testEmailTarget}
            >
              Send Email
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  );
}
