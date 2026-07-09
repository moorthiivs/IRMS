import { useState } from 'react';
import { Title, SimpleGrid, Paper, Text, Group, Select, Button, Table, Badge, Skeleton } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Play, FileCheck, Building2, Package, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import { useAuthStore } from '../store/auth-store';
import { TableSkeleton } from '../components/TableSkeleton';

export function Dashboard() {
  const { user, appMode } = useAuthStore();
  const navigate = useNavigate();
  
  // Inspector/Operator State
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);

  // Trend Chart State
  const [trendPart, setTrendPart] = useState<string | null>(null);
  const [trendOp, setTrendOp] = useState<string | null>(null);
  const [trendParam, setTrendParam] = useState<string | null>(null);
  const [trendDateRange, setTrendDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
  });

  const { data: operations = [] } = useQuery({
    queryKey: ['operations', selectedPart],
    queryFn: () => masterDataService.getOperationsByPart(selectedPart!),
    enabled: !!selectedPart && (user?.role === 'INSPECTOR' || user?.role === 'OPERATOR' || user?.role === 'SUPERVISOR'),
  });

  const { data: trendOperations = [] } = useQuery({
    queryKey: ['operations', trendPart],
    queryFn: () => masterDataService.getOperationsByPart(trendPart!),
    enabled: !!trendPart,
  });

  const { data: trendParameters = [] } = useQuery({
    queryKey: ['parameters', trendPart, trendOp],
    queryFn: () => masterDataService.getParameters(trendPart!, trendOp!),
    enabled: !!trendPart && !!trendOp,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: inspectionService.getDashboardData,
    enabled: user?.role === 'ADMIN',
  });

  // Trend data query
  const { data: trendData, isFetching: isTrendFetching } = useQuery({
    queryKey: ['trends', 'v2', trendPart, trendOp, trendDateRange],
    queryFn: () => {
      const params: any = { partId: trendPart!, operationId: trendOp! };
      if (trendDateRange[0] && trendDateRange[1]) {
        params.startDate = `${trendDateRange[0].getFullYear()}-${String(trendDateRange[0].getMonth() + 1).padStart(2, '0')}-${String(trendDateRange[0].getDate()).padStart(2, '0')}`;
        params.endDate = `${trendDateRange[1].getFullYear()}-${String(trendDateRange[1].getMonth() + 1).padStart(2, '0')}-${String(trendDateRange[1].getDate()).padStart(2, '0')}`;
      } else {
        params.days = 7;
      }
      return inspectionService.getTrends(params);
    },
    enabled: !!trendPart && !!trendOp,
  });

  const handleStartInspection = () => {
    let params = `?partId=${selectedPart}`;
    if (selectedOp) params += `&opId=${selectedOp}`;
    if (selectedMachine) params += `&mcNo=${encodeURIComponent(selectedMachine)}`;

    if (appMode === 'POKAYOKE' && selectedPart) {
      navigate(`/pokayoke/entry${params}`);
    } else if (selectedPart && selectedOp && selectedMachine) {
      navigate(`/inspection${params}`);
    }
  };

  if (user?.role === 'INSPECTOR' || user?.role === 'OPERATOR' || user?.role === 'SUPERVISOR') {
    // If the user has a customerId, use that; otherwise allow selection
    const userCustomerId = user.customerId || selectedCustomer;
    
    // Filter parts and customers
    const displayCustomers = user.customerId 
      ? customers.filter(c => c.id === user.customerId)
      : customers;
      
    const displayParts = userCustomerId
      ? parts.filter(p => p.customerId === userCustomerId)
      : [];

    const activeCustomer = customers.find(c => c.id === userCustomerId);
    const customerMachines = activeCustomer?.machines || [];
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <Title order={2} mb="md" ta="center">
          {appMode === 'POKAYOKE' ? 'Start Poka Yoke Entry' : 'Start New Inspection'}
        </Title>
        <Text c="dimmed" ta="center" mb="xl">
          {appMode === 'POKAYOKE' 
            ? 'Select the Part Number to begin entering readings.' 
            : 'Select the Part Number and Operation to begin entering readings.'}
        </Text>
        
        <Paper withBorder p="xl" radius="md" shadow="sm">
          {!user.customerId && (
            <Select
              label="Customer"
              placeholder="Select Customer"
              searchable
              size="md"
              data={displayCustomers.map(c => ({ value: c.id, label: c.name }))}
              value={selectedCustomer}
              onChange={(v) => { setSelectedCustomer(v); setSelectedPart(null); setSelectedOp(null); setSelectedMachine(null); }}
              mb="lg"
            />
          )}

          <Select
            label="Part Number"
            placeholder="Select Part"
            searchable
            size="md"
            disabled={!userCustomerId}
            data={displayParts.map(p => ({ value: p.id, label: p.partNumber }))}
            value={selectedPart}
            onChange={(v) => { setSelectedPart(v); setSelectedOp(null); setSelectedMachine(null); }}
            mb={appMode === 'POKAYOKE' ? 'xl' : 'lg'}
          />

          {appMode !== 'POKAYOKE' && (
            <Select
              label="Operation"
              placeholder="Select Operation"
              size="md"
              disabled={!selectedPart}
              data={operations.map(o => ({ value: o.id, label: o.operationNumber }))}
              value={selectedOp}
              onChange={setSelectedOp}
              mb="lg"
            />
          )}

          {appMode !== 'POKAYOKE' && (
            <Select
              label="Machine Number"
              placeholder="Select Machine"
              searchable
              size="md"
              disabled={!selectedOp || !selectedPart || customerMachines.length === 0}
              data={customerMachines}
              value={selectedMachine}
              onChange={setSelectedMachine}
              mb="xl"
              description={customerMachines.length === 0 ? "No machines available for this customer" : ""}
            />
          )}

          <Button 
            fullWidth 
            size="lg" 
            leftSection={<Play size={20} />}
            disabled={appMode === 'POKAYOKE' ? (!selectedPart) : (!selectedPart || !selectedOp || !selectedMachine)}
            onClick={handleStartInspection}
          >
            {appMode === 'POKAYOKE' ? 'Start Entry' : 'Start Inspection'}
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

  // Build trend chart options
  const buildTrendChart = () => {
    if (!trendData?.parameters || trendData.parameters.length === 0) return null;

    const dateLabels = (trendData.dateLabels || []).map((d: string) => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Filter by selected parameter or show all
    const paramsToShow = trendParam
      ? trendData.parameters.filter((p: any) => p.parameterId === trendParam)
      : trendData.parameters;

    const series: any[] = [];
    const annotations: any = { yaxis: [] };

    paramsToShow.forEach((param: any, idx: number) => {
      const label = param.parameterName;
      series.push({
        name: label,
        data: param.daily.map((d: any) => d.avg),
        type: 'area',
      });

      // Add control limit lines
      if (param.controlLimitMax !== null) {
        annotations.yaxis.push({
          y: param.controlLimitMax,
          yAxisIndex: idx,
          borderColor: '#fa5252',
          strokeDashArray: 4,
          label: {
            text: `UCL ${label}: ${param.controlLimitMax}`,
            style: { color: '#fff', background: '#fa5252', fontSize: '10px' },
            position: 'left',
          },
        });
      }
      if (param.controlLimitMin !== null) {
        annotations.yaxis.push({
          y: param.controlLimitMin,
          yAxisIndex: idx,
          borderColor: '#fd7e14',
          strokeDashArray: 4,
          label: {
            text: `LCL ${label}: ${param.controlLimitMin}`,
            style: { color: '#fff', background: '#fd7e14', fontSize: '10px' },
            position: 'left',
          },
        });
      }
    });

    const options: any = {
      chart: {
        id: 'trend-chart',
        toolbar: { show: true },
        zoom: { enabled: true },
      },
      stroke: { width: 3, curve: 'straight' },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.4,
          opacityTo: 0.05,
          stops: [0, 100]
        }
      },
      dataLabels: {
        enabled: false
      },
      markers: { size: 5, hover: { size: 7 } },
      xaxis: {
        categories: dateLabels,
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: paramsToShow.map((param: any, idx: number) => ({
        show: idx === 0 || (idx === 1 && paramsToShow.length === 2),
        opposite: idx === 1,
        seriesName: param.parameterName,
        title: { text: idx === 0 ? 'Observed Value' : (idx === 1 && paramsToShow.length === 2 ? 'Observed Value (Right)' : '') },
        labels: { formatter: (val: number) => val !== null && val !== undefined ? val.toFixed(3) : '' },
        axisBorder: { show: idx < 2 },
        axisTicks: { show: idx < 2 },
      })),
      annotations,
      legend: { position: 'top', horizontalAlign: 'left' },
      tooltip: {
        shared: true,
        intersect: false,
        custom: function({ dataPointIndex, w }: any) {
          const dateLabel = dateLabels[dataPointIndex];
          let html = `<div class="px-3 py-2 shadow-lg bg-white dark:bg-[#25262b] border border-gray-200 dark:border-gray-700 rounded-md text-gray-800 dark:text-gray-200" style="min-width: 250px;">`;
          html += `<div class="text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1 mb-2">${dateLabel}</div>`;

          paramsToShow.forEach((param: any, idx: number) => {
            const dailyData = param.daily[dataPointIndex];
            if (dailyData && dailyData.readings && dailyData.readings.length > 0) {
              const color = w.globals.colors[idx % w.globals.colors.length];
              
              let readingsHtml = '';
              dailyData.readings.forEach((r: any) => {
                let devText = '';
                if (param.nominalValue) {
                  const val = parseFloat(r.value);
                  const nom = parseFloat(param.nominalValue);
                  if (!isNaN(val) && !isNaN(nom)) {
                    const dev = val - nom;
                    const sign = dev >= 0 ? '+' : '';
                    devText = ` <span style="color: ${dev === 0 ? 'gray' : (dev > 0 ? 'green' : 'red')}">(${sign}${dev.toFixed(3)})</span>`;
                  }
                }
                const timeString = r.timestamp ? new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
                const timeLabel = timeString ? ` <span style="font-size: 0.85em; opacity: 0.7;">(${timeString})</span>` : '';
                readingsHtml += `
                  <div class="flex justify-between text-xs text-gray-700 dark:text-gray-300 py-0.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <span class="text-gray-500 dark:text-gray-400">${r.shiftName} - ${r.interval}${timeLabel}:</span>
                    <span class="font-semibold">${r.value}${devText}</span>
                  </div>
                `;
              });

              html += `
                <div class="mb-3 last:mb-0">
                  <div class="text-sm font-semibold flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 pb-0.5 mb-1">
                    <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${color}"></span>
                    ${param.parameterName}
                  </div>
                  <div class="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                    Spec: <strong>${param.specText || '-'}</strong> ${param.methodOfChecking ? `| Method: <strong>${param.methodOfChecking}</strong>` : ''}
                  </div>
                  <div class="pl-1">
                    ${readingsHtml}
                  </div>
                </div>
              `;
            } else {
              const color = w.globals.colors[idx % w.globals.colors.length];
              html += `
                <div class="mb-3 last:mb-0">
                  <div class="text-sm font-semibold flex items-center gap-1 border-b pb-0.5 mb-1">
                    <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${color}"></span>
                    ${param.parameterName}
                  </div>
                  <div class="text-xs text-gray-500 italic pl-3">
                    No readings for this date.
                  </div>
                </div>
              `;
            }
          });
          html += `</div>`;
          return html;
        }
      },
      grid: { borderColor: '#f1f3f5', strokeDashArray: 4 },
      colors: ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#e64980'],
    };

    return { series, options };
  };

  const trendChart = buildTrendChart();

  return (
    <div>
      <div className="mb-6">
        <Title order={2}>Dashboard</Title>
        <Text c="dimmed">Welcome back, {user?.name}</Text>
      </div>

      {/* Stat Cards */}
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

      {/* Row 2: Customer-wise + Part-wise summaries */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Paper withBorder p="md" radius="md" style={{ minHeight: 300 }}>
          <Group gap="sm" mb="md">
            <Building2 size={20} className="text-blue-500" />
            <Title order={4}>Customer Summary (Today)</Title>
          </Group>
          {isLoading ? (
            <TableSkeleton rows={3} />
          ) : data?.customerSummary && Object.keys(data.customerSummary).length > 0 ? (
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th className="text-center">Total</Table.Th>
                  <Table.Th className="text-center">Passed</Table.Th>
                  <Table.Th className="text-center">Rejected</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(data.customerSummary).map(([key, summary]: [string, any]) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Group gap="xs">
                        <Building2 size={14} className="text-gray-400" />
                        <Text fw={600} size="sm">{summary.name}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td className="text-center">
                      <Text fw={600}>{summary.total}</Text>
                    </Table.Td>
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
          ) : (
            <Text c="dimmed" size="sm">No customer data recorded today.</Text>
          )}
        </Paper>

        <Paper withBorder p="md" radius="md" style={{ minHeight: 300 }}>
          <Group gap="sm" mb="md">
            <Package size={20} className="text-teal-500" />
            <Title order={4}>Part Summary (Today)</Title>
          </Group>
          {isLoading ? (
            <TableSkeleton rows={3} />
          ) : data?.partSummary && Object.keys(data.partSummary).length > 0 ? (
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Part No</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th className="text-center">Total</Table.Th>
                  <Table.Th className="text-center">Passed</Table.Th>
                  <Table.Th className="text-center">Rejected</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {Object.entries(data.partSummary).map(([key, summary]: [string, any]) => (
                  <Table.Tr key={key}>
                    <Table.Td>
                      <Text fw={600} size="sm">{summary.partNumber}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">{summary.customerName || '—'}</Text>
                    </Table.Td>
                    <Table.Td className="text-center">
                      <Text fw={600}>{summary.total}</Text>
                    </Table.Td>
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
          ) : (
            <Text c="dimmed" size="sm">No part data recorded today.</Text>
          )}
        </Paper>
      </div>

      {/* Row 3: Recent Activity + Shift Summary */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Row 4: Parameter Trend Chart */}
      <Paper withBorder p="md" radius="md" mt="xl">
        <Group gap="sm" mb="md">
          <TrendingUp size={20} className="text-violet-500" />
          <Title order={4}>Parameter Trend Analysis</Title>
        </Group>
        <Text size="xs" c="dimmed" mb="md">
          Select a Part and Operation to view daily Min / Max / Avg readings over time. Control limits are shown as dashed lines.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="sm" mb="md">
          <Select
            placeholder="Select Part"
            size="xs"
            searchable
            data={parts.map(p => ({ value: p.id, label: p.partNumber }))}
            value={trendPart}
            onChange={(v) => { setTrendPart(v); setTrendOp(null); setTrendParam(null); }}
          />
          <Select
            placeholder="Select Operation"
            size="xs"
            disabled={!trendPart}
            data={trendOperations.map((o: any) => ({ value: o.id, label: o.operationNumber }))}
            value={trendOp}
            onChange={(v) => { setTrendOp(v); setTrendParam(null); }}
          />
          <Select
            placeholder="All Parameters"
            size="xs"
            clearable
            disabled={!trendOp}
            data={trendParameters.map((p: any) => ({ value: p.id, label: p.parameterName }))}
            value={trendParam}
            onChange={setTrendParam}
          />
          <DatePickerInput
            type="range"
            placeholder="Date range (default: 7 days)"
            size="xs"
            clearable
            value={trendDateRange}
            onChange={setTrendDateRange}
          />
        </SimpleGrid>

        {!trendPart || !trendOp ? (
          <div className="text-center py-12">
            <TrendingUp size={40} className="mx-auto text-gray-300 mb-3" />
            <Text c="dimmed" size="sm">Select a Part and Operation to see trends</Text>
          </div>
        ) : isTrendFetching ? (
          <Skeleton height={320} radius="md" />
        ) : trendChart ? (
          <div style={{ width: '100%', height: 350 }}>
            <Chart
              options={trendChart.options}
              series={trendChart.series}
              type="area"
              height={350}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <Text c="dimmed" size="sm">No trend data available for this selection.</Text>
          </div>
        )}
      </Paper>
    </div>
  );
}
