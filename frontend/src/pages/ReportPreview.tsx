import { useParams, useNavigate } from 'react-router-dom';
import { Title, Paper, Group, Button, Table, Text, Modal, Checkbox } from '@mantine/core';
import { Printer, ArrowLeft, FileCheck } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inspectionService } from '../services/inspection.service';
import { useAuthStore } from '../store/auth-store';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';

export function ReportPreview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [approvalModalOpened, setApprovalModalOpened] = useState(false);
  const [reviewedChecked, setReviewedChecked] = useState(false);

  const { data: inspection, isLoading } = useQuery({
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

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) return <div>Loading...</div>;
  if (!inspection) return <div>Not found</div>;

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
          {!inspection.approvedById && isAdmin && (
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
                  <Table.Td className="text-center font-semibold">
                    {detail.observedValue}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <div className="mt-8 flex justify-between">
            <Text fw={500}>Inspector: {inspection.inspector?.name}</Text>
            <Text fw={500}>Status: {inspection.status}</Text>
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
    </div>
  );
}
