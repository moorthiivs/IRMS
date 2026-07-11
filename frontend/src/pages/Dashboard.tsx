import { useState } from 'react';
import { Title, SimpleGrid, Paper, Text, Select, Button, Skeleton } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Play, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Chart from 'react-apexcharts';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import { useAuthStore } from '../store/auth-store';

export function MetricCard({ title, value, icon: Icon, isNegative, onClick }: any) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
      <Paper 
        withBorder 
        p="sm" 
        radius="md" 
        className={`cursor-pointer transition-colors hover:bg-gray-50 h-full ${onClick ? 'hover:shadow-md' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between mb-1">
          <Text size="xs" c="dimmed" fw={600} className="uppercase tracking-wider truncate">{title}</Text>
          {Icon && <Icon size={14} className="text-gray-400" />}
        </div>
        <div className="flex items-baseline gap-2">
          <Text size="xl" fw={700} className={isNegative ? 'text-red-600' : 'text-gray-800'}>
            {value}
          </Text>
        </div>
      </Paper>
    </motion.div>
  );
}

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
    
    // Filter machines based on activeMachines selection from the Customer data
    const activeMachines = activeCustomer?.activeMachines || [];
    const customerMachines = (activeCustomer?.machines || []).filter(
      (m: string) => activeMachines.length === 0 || activeMachines.includes(m)
    );
    
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

  const customerDonut = (() => {
    if (!data?.customerSummary) return null;
    const items: any[] = Object.values(data.customerSummary);
    if (items.length === 0) return null;
    return {
      series: items.map(c => c.total),
      options: {
        chart: { type: 'donut' as const },
        labels: items.map(c => c.name),
        legend: { position: 'bottom' as const, fontSize: '12px', itemMargin: { horizontal: 8, vertical: 4 } },
        plotOptions: { pie: { donut: { size: '75%' } } },
        stroke: { width: 2, colors: ['#fff'] },
        colors: ['#339af0', '#51cf66', '#fcc419', '#ff922b', '#ff6b6b', '#cc5de8', '#845ef7', '#20c997'],
        tooltip: { theme: 'light' as const }
      }
    };
  })();

  const partDonut = (() => {
    if (!data?.partSummary) return null;
    const items: any[] = Object.values(data.partSummary);
    if (items.length === 0) return null;
    return {
      series: items.map(p => p.total),
      options: {
        chart: { type: 'donut' as const },
        labels: items.map(p => p.partNumber),
        legend: { position: 'bottom' as const, fontSize: '12px', itemMargin: { horizontal: 8, vertical: 4 } },
        plotOptions: { pie: { donut: { size: '75%' } } },
        stroke: { width: 2, colors: ['#fff'] },
        colors: ['#20c997', '#845ef7', '#ff6b6b', '#339af0', '#fcc419', '#51cf66', '#ff922b', '#cc5de8'],
        tooltip: { theme: 'light' as const }
      }
    };
  })();

  return (
    <div className="bg-gradient-to-b from-gray-50 to-gray-100 min-h-[calc(100vh-100px)] rounded-xl border border-gray-100 shadow-sm p-4 lg:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Title order={3} size="h4" className="text-gray-800 tracking-tight font-display">Dashboard</Title>
          <Text size="xs" c="dimmed">Welcome back, {user?.name}</Text>
        </div>
      </div>

      {/* Top Section: High-Density 10-Block Grid */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5, lg: 5 }} spacing="xs" className="mb-4">
        {stats.map((stat, index) => (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} key={index}>
            <MetricCard {...stat} index={index} />
          </motion.div>
        ))}

        {user?.role === 'ADMIN' && (
          <>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 5 * 0.05 }}>
              <MetricCard 
                title="Total M/C Configured" 
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.totalMcCount || 0} 
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 6 * 0.05 }}>
              <MetricCard 
                title="Active M/C Today" 
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcCount || 0}
                onClick={() => navigate('/reports?hasMc=true&date=today')}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 7 * 0.05 }}>
              <MetricCard 
                title="Total M/C Reports" 
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcReportsTotal || 0}
                onClick={() => navigate('/reports?hasMc=true&date=today')}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 8 * 0.05 }}>
              <MetricCard 
                title="M/C Passed" 
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcReportsPassed || 0}
                onClick={() => navigate('/reports?hasMc=true&date=today&status=PASSED')}
                color="green"
                isNegative={false}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 9 * 0.05 }}>
              <MetricCard 
                title="M/C Failed" 
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcReportsFailed || 0}
                onClick={() => navigate('/reports?hasMc=true&date=today&status=REJECTED')}
                isNegative={true}
              />
            </motion.div>
          </>
        )}
      </SimpleGrid>

      {/* Middle Section: 3 Columns */}
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" className="mb-6">
        {/* Top Customers (Donut) */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Paper withBorder p="md" radius="xl" style={{ backgroundColor: '#fff', minHeight: 260 }} className="shadow-sm">
            <Text size="sm" fw={700} c="gray.7" className="mb-4">Customer Share (Today)</Text>
            {isLoading ? (
              <Skeleton height={180} />
            ) : customerDonut ? (
              <div className="w-full h-[220px]">
                <Chart options={customerDonut.options} series={customerDonut.series} type="donut" height="100%" width="100%" />
              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-12">No data today</Text>
            )}
          </Paper>
        </motion.div>

        {/* Recent Activity Bar Chart */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <Paper withBorder p="md" radius="xl" style={{ backgroundColor: '#fff', minHeight: 260 }} className="shadow-sm">
            <Text size="sm" fw={700} c="gray.7" className="mb-4">Recent Activity (7 Days)</Text>
            {isLoading ? (
              <Skeleton height={180} />
            ) : data?.recentActivity ? (
              <div className="w-full h-[220px]">
                <Chart
                  options={{
                    ...data.recentActivity.options,
                    chart: { ...data.recentActivity.options.chart, toolbar: { show: false }, parentHeightOffset: 0 },
                    plotOptions: { bar: { columnWidth: '50%', borderRadius: 4 } },
                    tooltip: { theme: 'light' as const },
                    grid: { show: false, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
                    xaxis: { ...data.recentActivity.options.xaxis, labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
                    yaxis: { ...data.recentActivity.options.yaxis, labels: { show: false } }
                  }}
                  series={data.recentActivity.series}
                  type="bar"
                  height="100%"
                  width="100%"
                />
              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-12">No data</Text>
            )}
          </Paper>
        </motion.div>

        {/* Top Parts (Donut) */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.4 }}>
          <Paper withBorder p="md" radius="xl" style={{ backgroundColor: '#fff', minHeight: 260 }} className="shadow-sm">
            <Text size="sm" fw={700} c="gray.7" className="mb-4">Part Share (Today)</Text>
            {isLoading ? (
              <Skeleton height={180} />
            ) : partDonut ? (
              <div className="w-full h-[220px]">
                <Chart options={partDonut.options} series={partDonut.series} type="donut" height="100%" width="100%" />
              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-12">No data today</Text>
            )}
          </Paper>
        </motion.div>
      </SimpleGrid>

      {/* Bottom Section: Progress Bars & Large Trend Chart */}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        {/* Status Code Stats equivalent (Shift Progress Bars) */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>
          <Paper withBorder p="md" radius="xl" style={{ backgroundColor: '#fff', height: '100%' }} className="shadow-sm">
            <Text size="sm" fw={700} c="gray.7" className="mb-4">Shift Status Codes</Text>
            {isLoading ? (
              <div className="space-y-4"><Skeleton height={20}/><Skeleton height={20}/></div>
            ) : data?.shiftSummary && Object.keys(data.shiftSummary).length > 0 ? (
              <div className="space-y-4 overflow-y-auto" style={{ maxHeight: 250 }}>
                {Object.entries(data.shiftSummary).map(([shiftName, summary]: [string, any]) => {
                  const passPct = summary.total > 0 ? (summary.pass / summary.total) * 100 : 0;
                  const failPct = summary.total > 0 ? (summary.fail / summary.total) * 100 : 0;
                  return (
                    <div key={shiftName}>
                      <div className="flex justify-between text-xs font-semibold mb-1 text-gray-700">
                        <span>{shiftName}</span>
                        <span className="text-gray-500">{summary.total} Total</span>
                      </div>
                      <div className="flex h-3 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        {passPct > 0 && (
                          <div style={{ width: `${passPct}%` }} className="bg-green-500 flex items-center justify-center text-[9px] text-white font-bold px-1" title={`${summary.pass} Passed`}>
                            {passPct > 10 ? `${passPct.toFixed(0)}%` : ''}
                          </div>
                        )}
                        {failPct > 0 && (
                          <div style={{ width: `${failPct}%` }} className="bg-red-500 flex items-center justify-center text-[9px] text-white font-bold px-1" title={`${summary.fail} Failed`}>
                            {failPct > 10 ? `${failPct.toFixed(0)}%` : ''}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] mt-1 text-gray-500">
                        <span>Pass: {summary.pass}</span>
                        <span>Fail: {summary.fail}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-8">No shift data</Text>
            )}
          </Paper>
        </motion.div>

        {/* Full Parameter Trend Chart spanning 2 columns */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.6 }} style={{ gridColumn: 'span 2' }}>
          <Paper withBorder p="md" radius="xl" style={{ backgroundColor: '#fff', height: '100%' }} className="shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <Text size="sm" fw={700} c="gray.7">Parameter Trend Analysis</Text>
              
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Select
                  placeholder="Part"
                  size="xs"
                  searchable
                  radius="md"
                  data={parts.map(p => ({ value: p.id, label: p.partNumber }))}
                value={trendPart}
                onChange={(v) => { setTrendPart(v); setTrendOp(null); setTrendParam(null); }}
                style={{ width: 120 }}
              />
              <Select
                placeholder="Op"
                size="xs"
                disabled={!trendPart}
                data={trendOperations.map((o: any) => ({ value: o.id, label: o.operationNumber }))}
                value={trendOp}
                onChange={(v) => { setTrendOp(v); setTrendParam(null); }}
                style={{ width: 100 }}
              />
              <Select
                placeholder="Param"
                size="xs"
                clearable
                disabled={!trendOp}
                data={trendParameters.map((p: any) => ({ value: p.id, label: p.parameterName }))}
                value={trendParam}
                onChange={setTrendParam}
                style={{ width: 120 }}
              />
              <DatePickerInput
                type="range"
                placeholder="Date"
                size="xs"
                clearable
                value={trendDateRange}
                onChange={setTrendDateRange}
                style={{ width: 160 }}
              />
            </div>
          </div>

          {!trendPart || !trendOp ? (
            <div className="text-center py-10">
              <Text c="dimmed" size="xs">Select a Part and Operation to see trends</Text>
            </div>
          ) : isTrendFetching ? (
            <Skeleton height={240} />
          ) : trendChart ? (
            <div style={{ width: '100%', height: 260, marginTop: -10 }}>
              <Chart options={trendChart.options} series={trendChart.series} type="area" height={260} />
            </div>
          ) : (
            <div className="text-center py-10">
              <Text c="dimmed" size="xs">No trend data available.</Text>
            </div>
          )}
        </Paper>
        </motion.div>
      </SimpleGrid>
    </div>
  );
}
