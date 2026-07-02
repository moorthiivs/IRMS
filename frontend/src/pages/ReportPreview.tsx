import { useParams, useNavigate } from 'react-router-dom';
import { Title, Paper, Group, Button, Table, Text, Modal, Checkbox, Badge, TextInput, Textarea, Timeline, ThemeIcon, Autocomplete } from '@mantine/core';
import { Printer, ArrowLeft, FileCheck, Wrench, History, ArrowRight, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionService } from '../services/inspection.service';
import { useAuthStore } from '../store/auth-store';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { CorrectionEntry } from '../types';
import { modals } from '@mantine/modals';

export function ReportPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [approvalModalOpened, setApprovalModalOpened] = useState(false);
  const [reviewedChecked, setReviewedChecked] = useState(false);

  // Feature 5: Correction state
  const [correctionModalOpened, setCorrectionModalOpened] = useState(false);
  const [correctionValues, setCorrectionValues] = useState<Record<string, string>>({});
  const [correctionRemarks, setCorrectionRemarks] = useState('');

  // Feature 5: Audit Trail state
  const [auditTrailOpened, setAuditTrailOpened] = useState(false);
  const [auditTrailData, setAuditTrailData] = useState<CorrectionEntry[]>([]);

  const { data: inspection, isLoading, refetch } = useQuery({
    queryKey: ['inspection', id],
    queryFn: () => inspectionService.getById(id!),
    enabled: !!id
  });

  const approveMutation = useMutation({
    mutationFn: inspectionService.approveInspection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection', id] });
      queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
      setApprovalModalOpened(false);
      setReviewedChecked(false);
      notifications.show({ title: 'Approved', message: 'Inspection approved successfully.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to approve.', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: inspectionService.deleteInspection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['daily-report'] });
      notifications.show({ title: 'Deleted', message: 'Inspection report deleted successfully.', color: 'green' });
      navigate(-1);
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to delete report.', color: 'red' });
    },
  });

  const handleDelete = () => {
    modals.openConfirmModal({
      title: 'Delete Inspection Report',
      centered: true,
      children: (
        <Text size="sm">
          Are you sure you want to delete this inspection report? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete Report', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(id!),
    });
  };

  // Feature 5: Correction mutation
  const correctionMutation = useMutation({
    mutationFn: ({ txId, payload }: { txId: string; payload: any }) =>
      inspectionService.correctInspection(txId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspection', id] });
      queryClient.invalidateQueries({ queryKey: ['recent-inspections'] });
      setCorrectionModalOpened(false);
      setCorrectionValues({});
      setCorrectionRemarks('');
      refetch();
      notifications.show({ title: 'Correction Saved', message: 'Failed parameters corrected. Status re-evaluated.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to save corrections.', color: 'red' });
    },
  });

  const handleOpenCorrection = () => {
    if (!inspection) return;
    const initialValues: Record<string, string> = {};
    inspection.details?.filter(d => d.status === 'FAIL').forEach(d => {
      initialValues[d.id] = d.observedValue;
    });
    setCorrectionValues(initialValues);
    setCorrectionRemarks('');
    setCorrectionModalOpened(true);
  };

  const handleSubmitCorrections = () => {
    if (!inspection) return;
    const corrections = Object.entries(correctionValues)
      .filter(([detailId, value]) => {
        const original = inspection.details?.find(d => d.id === detailId);
        return original && value !== original.observedValue;
      })
      .map(([detailId, correctedValue]) => ({ detailId, correctedValue }));

    if (corrections.length === 0) {
      notifications.show({ title: 'No Changes', message: 'Modify at least one value.', color: 'orange' });
      return;
    }

    correctionMutation.mutate({
      txId: inspection.id,
      payload: { corrections, remarks: correctionRemarks || undefined },
    });
  };

  const handleViewAuditTrail = async () => {
    if (!id) return;
    try {
      const trail = await inspectionService.getAuditTrail(id);
      setAuditTrailData(trail);
      setAuditTrailOpened(true);
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to load audit trail.', color: 'red' });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) return <div>Loading...</div>;
  if (!inspection) return <div>Not found</div>;

  const failedDetails = inspection.details?.filter(d => d.status === 'FAIL') || [];

  return (
    <div>
      <Group justify="space-between" mb="lg" className="print:hidden">
        <Group>
          <Button variant="light" leftSection={<ArrowLeft size={16} />} onClick={() => navigate(-1)}>
            Back
          </Button>
          <Title order={2}>Check Sheet Print Preview</Title>
        </Group>
        <Group>
          {/* Feature 5: Take Action for rejected */}
          {inspection.status === 'REJECTED' && failedDetails.length > 0 && (
            <Button
              color="orange"
              leftSection={<Wrench size={16} />}
              onClick={handleOpenCorrection}
            >
              Take Action
            </Button>
          )}
          {/* Feature 5: Audit Trail */}
          <Button
            variant="light"
            color="cyan"
            leftSection={<History size={16} />}
            onClick={handleViewAuditTrail}
          >
            Audit Trail
          </Button>
          {inspection.status === 'PASSED' && !inspection.approvedById && isAdmin && (
            <Button 
              color="violet"
              leftSection={<FileCheck size={16} />}
              loading={approveMutation.isPending}
              onClick={() => {
                setApprovalModalOpened(true);
                setReviewedChecked(false);
              }}
            >
              Approve Report
            </Button>
          )}
          {isAdmin && (
            <Button
              color="red"
              variant="outline"
              leftSection={<Trash2 size={16} />}
              loading={deleteMutation.isPending}
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}
          <Button leftSection={<Printer size={16} />} onClick={handlePrint}>
            Print Checksheet
          </Button>
        </Group>
      </Group>

      {/* A4 Landscape Print Area */}
      <Paper withBorder p="xl" className="print:border-0 print:p-0 bg-white min-h-[500px] overflow-x-auto print:overflow-visible">
        <div className="min-w-[800px] print:min-w-full">
          <div className="text-center mb-6">
            <Title order={3}>YNC Cover plate check sheet</Title>
            <Text>Part: {inspection.part?.partNumber} | Operation: {inspection.operation?.operationNumber}</Text>
            <Text>Date: {new Date(inspection.inspectionTimestamp).toLocaleDateString()}</Text>
          </div>

          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th rowSpan={2}>S.No</Table.Th>
                <Table.Th rowSpan={2}>Characteristics</Table.Th>
                <Table.Th rowSpan={2}>Specification</Table.Th>
                <Table.Th colSpan={1} className="text-center">Observations ({inspection.shift?.name})</Table.Th>
              </Table.Tr>
              <Table.Tr>
                <Table.Th className="text-center">{inspection.intervalName}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {inspection.details?.map((detail, index) => (
                <Table.Tr key={detail.id}>
                  <Table.Td>{index + 1}</Table.Td>
                  <Table.Td>{detail.parameter?.parameterName}</Table.Td>
                  <Table.Td>{detail.parameter?.specText}</Table.Td>
                  <Table.Td className={`text-center font-semibold ${detail.status === 'FAIL' ? 'text-red-600' : ''}`}>
                    {detail.observedValue}
                    {detail.status === 'FAIL' && (
                      <Badge color="red" size="xs" variant="light" ml="xs">FAIL</Badge>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <div className="mt-8 flex justify-between">
            <Text fw={500}>Inspector: {inspection.inspector?.name}</Text>
            <Text fw={500}>
              Status: <Badge color={inspection.status === 'PASSED' ? 'green' : 'red'} variant="filled">{inspection.status}</Badge>
            </Text>
          </div>
        </div>
      </Paper>

      {/* Approval Modal */}
      <Modal 
        opened={approvalModalOpened} 
        onClose={() => { setApprovalModalOpened(false); setReviewedChecked(false); }}
        title="Confirm Approval"
      >
        <Text size="sm" mb="md">
          Are you sure you want to approve this inspection? You must read and verify the values before approving.
        </Text>
        <Checkbox 
          label="I confirm that I have reviewed the full report and validated the values."
          checked={reviewedChecked}
          onChange={(e) => setReviewedChecked(e.currentTarget.checked)}
          mb="lg"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => { setApprovalModalOpened(false); setReviewedChecked(false); }}>Cancel</Button>
          <Button 
            color="violet" 
            disabled={!reviewedChecked}
            loading={approveMutation.isPending}
            onClick={() => {
              approveMutation.mutate(id!);
            }}
          >
            Approve
          </Button>
        </Group>
      </Modal>

      {/* Feature 5: Correction Modal */}
      <Modal
        opened={correctionModalOpened}
        onClose={() => { setCorrectionModalOpened(false); setCorrectionValues({}); setCorrectionRemarks(''); }}
        title="Take Action — Correct Failed Parameters"
        size="lg"
      >
        <Paper withBorder p="sm" radius="md" mb="md" className="bg-red-50">
          <Group gap="xs" mb="xs">
            <Badge color="red" variant="filled" size="sm">REJECTED</Badge>
            <Text size="sm" fw={600}>
              {inspection.part?.partNumber} / {inspection.operation?.operationNumber}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {inspection.shift?.name} — {inspection.intervalName}
          </Text>
        </Paper>

        <Text size="sm" fw={600} mb="sm">Failed Parameters (editable):</Text>

        <Table withTableBorder withColumnBorders verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Parameter</Table.Th>
              <Table.Th>Specification</Table.Th>
              <Table.Th>Original</Table.Th>
              <Table.Th>Corrected Value</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {failedDetails.map(detail => (
              <Table.Tr key={detail.id}>
                <Table.Td><Text size="sm" fw={500}>{detail.parameter?.parameterName}</Text></Table.Td>
                <Table.Td><Text size="xs">{detail.parameter?.specText || '-'}</Text></Table.Td>
                <Table.Td><Badge color="red" variant="light">{detail.observedValue}</Badge></Table.Td>
                <Table.Td>
                  {detail.parameter?.controlLimitMin !== null ? (
                    <TextInput
                      size="sm"
                      value={correctionValues[detail.id] || ''}
                      onChange={(e) => setCorrectionValues(prev => ({ ...prev, [detail.id]: e.target.value }))}
                      onBlur={(e) => {
                        const val = e.target.value;
                        const lc = detail.parameter?.leastCount;
                        if (lc && lc > 0) {
                          const decimalPlaces = Math.round(-Math.log10(lc));
                          const parts = val.split('.');
                          if (parts.length === 2 && parts[1].length > decimalPlaces) {
                            setCorrectionValues(prev => ({ ...prev, [detail.id]: parseFloat(val).toFixed(decimalPlaces) }));
                          }
                        }
                      }}
                      placeholder="Enter corrected value"
                      type="number"
                      inputMode="decimal"
                      step={detail.parameter?.leastCount && detail.parameter.leastCount > 0 ? String(detail.parameter.leastCount) : '0.001'}
                    />
                  ) : (
                    <Autocomplete
                      size="sm"
                      value={correctionValues[detail.id] || ''}
                      onChange={(val) => setCorrectionValues(prev => ({ ...prev, [detail.id]: val }))}
                      placeholder="Select or type OK/NG"
                      data={['OK', 'NG']}
                    />
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Textarea
          label="Correction Remarks"
          placeholder="Reason for correction..."
          value={correctionRemarks}
          onChange={(e) => setCorrectionRemarks(e.target.value)}
          mt="md"
        />

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => { setCorrectionModalOpened(false); setCorrectionValues({}); setCorrectionRemarks(''); }}>
            Cancel
          </Button>
          <Button
            color="orange"
            loading={correctionMutation.isPending}
            onClick={handleSubmitCorrections}
            leftSection={<Wrench size={16} />}
          >
            Submit Corrections
          </Button>
        </Group>
      </Modal>

      {/* Feature 5: Audit Trail Modal */}
      <Modal
        opened={auditTrailOpened}
        onClose={() => { setAuditTrailOpened(false); setAuditTrailData([]); }}
        title="Audit Trail — Correction History"
        size="lg"
      >
        {auditTrailData.length === 0 ? (
          <Paper withBorder p="xl" radius="md">
            <Text ta="center" c="dimmed">No corrections have been made to this inspection.</Text>
          </Paper>
        ) : (
          <Timeline active={auditTrailData.length - 1} bulletSize={28} lineWidth={2}>
            {auditTrailData.map((entry) => (
              <Timeline.Item
                key={entry.id}
                bullet={
                  <ThemeIcon
                    size={28}
                    variant="filled"
                    color={entry.correctedStatus === 'PASS' ? 'green' : 'orange'}
                    radius="xl"
                  >
                    <Wrench size={14} />
                  </ThemeIcon>
                }
                title={
                  <Group gap="xs">
                    <Text size="sm" fw={600}>{entry.detail?.parameter?.parameterName || 'Parameter'}</Text>
                    <Badge
                      color={entry.correctedStatus === 'PASS' ? 'green' : 'red'}
                      variant="light"
                      size="xs"
                    >
                      {entry.correctedStatus}
                    </Badge>
                  </Group>
                }
              >
                <Group gap="sm" mt="xs">
                  <Badge color="red" variant="light" size="sm">{entry.previousValue}</Badge>
                  <ArrowRight size={14} className="text-gray-400" />
                  <Badge color="green" variant="light" size="sm">{entry.correctedValue}</Badge>
                </Group>
                <Text size="xs" c="dimmed" mt={4}>
                  By {entry.correctedBy?.name || 'Unknown'} at {new Date(entry.correctedAt).toLocaleString()}
                </Text>
                {entry.remarks && (
                  <Text size="xs" c="dimmed" fs="italic" mt={2}>
                    Remarks: {entry.remarks}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Modal>
    </div>
  );
}
