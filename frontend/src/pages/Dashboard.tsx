import { useState } from 'react';
import { Title, SimpleGrid, Paper, Text, Group, Select, Button, Table, Badge, Skeleton } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Play, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import { useAuthStore } from '../store/auth-store';
import { TableSkeleton } from '../components/TableSkeleton';

export function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  // Inspector State
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
    enabled: user?.role === 'INSPECTOR',
  });

  const { data: operations = [] } = useQuery({
    queryKey: ['operations', selectedPart],
    queryFn: () => masterDataService.getOperationsByPart(selectedPart!),
    enabled: !!selectedPart && user?.role === 'INSPECTOR',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: inspectionService.getDashboardData,
    enabled: user?.role === 'ADMIN',
  });

  const handleStartInspection = () => {
    if (selectedPart && selectedOp) {
      navigate(`/inspection?partId=${selectedPart}&opId=${selectedOp}`);
    }
  };

  if (user?.role === 'INSPECTOR') {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <Title order={2} mb="md" ta="center">Start New Inspection</Title>
        <Text c="dimmed" ta="center" mb="xl">Select the Part Number and Operation to begin entering readings.</Text>
        
        <Paper withBorder p="xl" radius="md" shadow="sm">
          <Select
            label="Part Number"
            placeholder="Select Part from Master Data"
            searchable
            size="md"
            data={parts.map(p => ({ value: p.id, label: p.partNumber }))}
            value={selectedPart}
            onChange={(v) => { setSelectedPart(v); setSelectedOp(null); }}
            mb="lg"
          />
          <Select
            label="Operation"
            placeholder="Select Operation"
            size="md"
            disabled={!selectedPart}
            data={operations.map(o => ({ value: o.id, label: o.operationNumber }))}
            value={selectedOp}
            onChange={setSelectedOp}
            mb="xl"
          />
          <Button 
            fullWidth 
            size="lg" 
            leftSection={<Play size={20} />}
            disabled={!selectedPart || !selectedOp}
            onClick={handleStartInspection}
          >
            Start Inspection
          </Button>
        </Paper>
      </div>
    );
  }

  const stats = [
    { title: 'Total Inspections', value: data?.total || 0, icon: ClipboardCheck, color: 'blue', to: '/reports' },
    { title: 'Passed Lots', value: data?.passed || 0, icon: CheckCircle2, color: 'teal', to: '/reports?status=PASSED' },
    { title: 'Rejected Lots', value: data?.rejected || 0, icon: XCircle, color: 'red', to: '/reports?status=REJECTED' },
    { title: 'Pending Today', value: data?.pending || 0, icon: Clock, color: 'orange', to: null },
    { title: 'Approval Pending', value: data?.approvalPending || 0, icon: FileCheck, color: 'violet', to: '/reports?approval=pending' },
  ];

  return (
    <div>
      <div className="mb-6">
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed">Welcome back, {user?.name}</Text>
      </div>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
        {stats.map((stat) => (
          <Paper
            withBorder
            p="md"
            radius="md"
            key={stat.title}
            onClick={stat.to ? () => navigate(stat.to!) : undefined}
            style={{
              cursor: stat.to ? 'pointer' : 'default',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            className={stat.to ? 'hover:shadow-md hover:-translate-y-0.5' : ''}
          >
            <Group justify="space-between">
              <Text size="xs" c="dimmed" className="uppercase font-bold">
                {stat.title}
              </Text>
              <stat.icon className={`text-${stat.color}-500`} size={20} />
            </Group>

            <Group align="flex-end" gap="xs" mt={25}>
              <div className="text-3xl font-bold">
                {isLoading ? <Skeleton height={36} width={60} radius="sm" /> : stat.value}
              </div>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Paper withBorder p="md" radius="md" style={{ minHeight: 350 }}>
          <Title order={4} mb="md">Recent Activity (Last 7 Days)</Title>
          {isLoading ? (
            <Skeleton height={260} radius="md" />
          ) : data?.recentActivity ? (
            <div style={{ width: '100%', height: 260 }}>
              <Chart
                options={data.recentActivity.options}
                series={data.recentActivity.series}
                type={data.recentActivity.type || 'bar'}
                height={260}
              />
            </div>
          ) : (
            <Text c="dimmed" size="sm">No recent activity data available.</Text>
          )}
        </Paper>

        <Paper withBorder p="md" radius="md" style={{ minHeight: 350 }}>
          <Title order={4} mb="md">Shift Summary (Today)</Title>
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={3} /></div>
          ) : data?.shiftSummary && Object.keys(data.shiftSummary).length > 0 ? (
            <div className="overflow-x-auto">
              <Table striped highlightOnHover verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Shift</Table.Th>
                    <Table.Th className="text-center">Total Inspections</Table.Th>
                    <Table.Th className="text-center">Passed</Table.Th>
                    <Table.Th className="text-center">Rejected</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(data.shiftSummary).map(([shiftName, summary]: [string, any]) => (
                    <Table.Tr key={shiftName}>
                      <Table.Td className="font-semibold">{shiftName}</Table.Td>
                      <Table.Td className="text-center">{summary.total}</Table.Td>
                      <Table.Td className="text-center">
                        <Badge color="green" variant="light">{summary.pass}</Badge>
                      </Table.Td>
                      <Table.Td className="text-center">
                        <Badge color="red" variant="light">{summary.fail}</Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          ) : (
            <Text c="dimmed" size="sm">No shift transactions recorded today.</Text>
          )}
        </Paper>
      </div>
    </div>
  );
}
