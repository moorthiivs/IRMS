import { useState } from 'react';
import { Title, SimpleGrid, Paper, Text, Select, Button, Skeleton, useComputedColorScheme, Divider } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ClipboardCheck, CheckCircle2, XCircle, Clock, Play, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import { useAuthStore } from '../store/auth-store';

export function MetricCard({ title, value, icon: Icon, isNegative, onClick, color = 'blue' }: any) {
  const iconBgColors: any = {
    blue: 'bg-blue-500 text-white shadow-md shadow-blue-500/20',
    teal: 'bg-teal-500 text-white shadow-md shadow-teal-500/20',
    red: 'bg-red-500 text-white shadow-md shadow-red-500/20',
    orange: 'bg-orange-500 text-white shadow-md shadow-orange-500/20',
    violet: 'bg-violet-500 text-white shadow-md shadow-violet-500/20',
    green: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20',
    indigo: 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20',
    cyan: 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20',
    pink: 'bg-pink-500 text-white shadow-md shadow-pink-500/20',
    yellow: 'bg-amber-500 text-white shadow-md shadow-amber-500/20',
  };

  const cardBgColors: any = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800/80',
    teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-300 dark:border-teal-800/80',
    red: 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800/80',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800/80',
    violet: 'bg-violet-50 dark:bg-violet-900/20 border-violet-300 dark:border-violet-800/80',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800/80',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-800/80',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-800/80',
    pink: 'bg-pink-50 dark:bg-pink-900/20 border-pink-300 dark:border-pink-800/80',
    yellow: 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800/80',
  };

  return (
    <motion.div whileHover={{ scale: 1.02, y: -2 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
      <Paper
        withBorder
        p="md"
        radius="lg"
        className={`cursor-pointer transition-all hover:shadow-lg h-full ${cardBgColors[color] || 'bg-white dark:bg-[#1a1b1e]'}`}
        onClick={onClick}
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <Text size="sm" c="dimmed" fw={600} className="mb-1">{title}</Text>
            <Text size="xl" fw={800} className={isNegative ? 'text-red-500 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}>
              {value}
            </Text>
          </div>
          {Icon && (
            <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full ${iconBgColors[color] || iconBgColors.blue}`}>
              <Icon size={20} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 mt-2">
          <Text size="xs" c="dimmed" fw={500}>
            <span className={isNegative ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}>
              {isNegative ? '-1.05%' : '+2.08%'}
            </span> vs last month
          </Text>
        </div>
      </Paper>
    </motion.div>
  );
}

export function Dashboard() {
  const { user, appMode } = useAuthStore();
  const navigate = useNavigate();
  //const theme = useMantineTheme();
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true });
  const paperBgColor = colorScheme === 'dark' ? '#1a1b1e' : '#ffffff';

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

  // Dashboard Options
  const [showMachineStats, setShowMachineStats] = useState(true);
  const [dashboardDateRange, setDashboardDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [dashboardCustomer, setDashboardCustomer] = useState<string | null>(null);

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
    queryKey: ['dashboard-stats', dashboardCustomer, dashboardDateRange],
    queryFn: () => {
      const filters: any = {};
      if (dashboardCustomer) filters.customerId = dashboardCustomer;
      if (dashboardDateRange[0]) {
        filters.startDate = `${dashboardDateRange[0].getFullYear()}-${String(dashboardDateRange[0].getMonth() + 1).padStart(2, '0')}-${String(dashboardDateRange[0].getDate()).padStart(2, '0')}`;
      }
      if (dashboardDateRange[1]) {
        filters.endDate = `${dashboardDateRange[1].getFullYear()}-${String(dashboardDateRange[1].getMonth() + 1).padStart(2, '0')}-${String(dashboardDateRange[1].getDate()).padStart(2, '0')}`;
      }
      return inspectionService.getDashboardData(filters);
    },
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

  const dateLabel = dashboardDateRange[0] || dashboardDateRange[1] ? 'Selected Period' : 'Today';

  const stats = [
    { title: 'Total Inspections', value: isLoading ? <Skeleton height={24} width={40} /> : data?.total || 0, icon: ClipboardCheck, color: 'blue', to: '/reports' },
    { title: 'Passed Lots', value: isLoading ? <Skeleton height={24} width={40} /> : data?.passed || 0, icon: CheckCircle2, color: 'teal', to: '/reports?status=PASSED' },
    { title: 'Rejected Lots', value: isLoading ? <Skeleton height={24} width={40} /> : data?.rejected || 0, icon: XCircle, color: 'red', to: '/reports?status=REJECTED' },
    { title: `Pending ${dateLabel}`, value: isLoading ? <Skeleton height={24} width={40} /> : data?.pending || 0, icon: Clock, color: 'orange', to: null },
    { title: 'Approval Pending', value: isLoading ? <Skeleton height={24} width={40} /> : data?.approvalPending || 0, icon: FileCheck, color: 'violet', to: '/reports?approval=pending' },
  ];

  // Build trend chart options
  const buildTrendChart = () => {
    if (!trendData?.parameters || trendData.parameters.length === 0) return null;

    const dateLabels = (trendData.dateLabels || []).map((d: string) => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    const paramsToShow = trendParam
      ? trendData.parameters.filter((p: any) => p.parameterId === trendParam)
      : trendData.parameters;

    const colors = ['#008FFB', '#00E396', '#FEB019', '#FF4560', '#775DD0', '#e64980'];
    const series: any[] = [];

    paramsToShow.forEach((param: any, idx: number) => {
      const color = colors[idx % colors.length];
      const seriesObj: any = {
        name: param.parameterName,
        type: 'line',
        data: param.daily.map((d: any) => d.avg !== null ? Number(d.avg.toFixed(3)) : null),
        yAxisIndex: idx === 1 && paramsToShow.length === 2 ? 1 : 0,
        itemStyle: { color },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: color },
            { offset: 1, color: 'rgba(255,255,255,0)' }
          ]),
          opacity: 0.3
        },
        symbol: 'circle',
        symbolSize: 6,
        label: { show: !trendParam, position: 'top', formatter: '{c}', fontSize: 10 },
        markLine: { data: [], symbol: ['none', 'none'], label: { position: 'end' } },
        markArea: { data: [], itemStyle: { opacity: 0.2 } },
      };

      if (trendParam && param.controlLimitMax !== null && param.controlLimitMin !== null) {
        const MAX = param.controlLimitMax;
        const MIN = param.controlLimitMin;
        const MEAN = (MAX + MIN) / 2;
        const TOLER = MAX - MIN;
        const TOLER_70 = TOLER * 0.70;
        const UCL = MEAN + (TOLER_70 / 2);
        const LCL = MEAN - (TOLER_70 / 2);

        // Mark areas
        seriesObj.markArea.data.push(
          [{ yAxis: MAX, itemStyle: { color: '#ef4444' } }, { yAxis: MAX + (TOLER * 1.5) }],
          [{ yAxis: UCL, itemStyle: { color: '#eab308' } }, { yAxis: MAX }],
          [{ yAxis: LCL, itemStyle: { color: '#22c55e' } }, { yAxis: UCL }],
          [{ yAxis: MIN, itemStyle: { color: '#eab308' } }, { yAxis: LCL }],
          [{ yAxis: MIN - (TOLER * 1.5), itemStyle: { color: '#ef4444' } }, { yAxis: MIN }]
        );

        // Mark lines
        seriesObj.markLine.data.push(
          { yAxis: MAX, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'Max', color: '#fff', backgroundColor: '#ef4444', padding: [2, 4] } },
          { yAxis: UCL, lineStyle: { color: '#eab308', type: 'dashed' }, label: { formatter: 'UCL', color: '#fff', backgroundColor: '#eab308', padding: [2, 4] } },
          { yAxis: MEAN, lineStyle: { color: '#22c55e', type: 'dotted' }, label: { formatter: 'Mean', color: '#fff', backgroundColor: '#22c55e', padding: [2, 4] } },
          { yAxis: LCL, lineStyle: { color: '#eab308', type: 'dashed' }, label: { formatter: 'LCL', color: '#fff', backgroundColor: '#eab308', padding: [2, 4] } },
          { yAxis: MIN, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: 'Min', color: '#fff', backgroundColor: '#ef4444', padding: [2, 4] } }
        );
      } else if (trendParam && param.controlLimitMax !== null) {
        seriesObj.markLine.data.push({ yAxis: param.controlLimitMax, lineStyle: { color: '#ef4444', type: 'dotted' }, label: { formatter: `Max: ${param.controlLimitMax}` } });
      } else if (trendParam && param.controlLimitMin !== null) {
        seriesObj.markLine.data.push({ yAxis: param.controlLimitMin, lineStyle: { color: '#ef4444', type: 'dotted' }, label: { formatter: `Min: ${param.controlLimitMin}` } });
      }

      series.push(seriesObj);
    });

    const options: any = {
      grid: { top: 45, right: 60, bottom: 40, left: 60 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: function (params: any) {
          const dataIndex = params[0].dataIndex;
          const dateLabel = dateLabels[dataIndex];
          let html = `<div class="px-3 py-2 shadow-lg bg-white dark:bg-[#25262b] border border-gray-200 dark:border-gray-700 rounded-md text-gray-800 dark:text-gray-200" style="min-width: 250px;">`;
          html += `<div class="text-xs font-bold text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1 mb-2">${dateLabel}</div>`;

          paramsToShow.forEach((param: any, idx: number) => {
            const dailyData = param.daily[dataIndex];
            const color = colors[idx % colors.length];
            if (dailyData && dailyData.readings && dailyData.readings.length > 0) {
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
                  <div class="pl-1">${readingsHtml}</div>
                </div>
              `;
            } else {
              html += `
                <div class="mb-3 last:mb-0">
                  <div class="text-sm font-semibold flex items-center gap-1 border-b pb-0.5 mb-1">
                    <span class="w-2 h-2 rounded-full inline-block" style="background-color: ${color}"></span>
                    ${param.parameterName}
                  </div>
                  <div class="text-xs text-gray-500 italic pl-3">No readings for this date.</div>
                </div>
              `;
            }
          });
          html += `</div>`;
          return html;
        }
      },
      legend: { data: paramsToShow.map((p: any) => p.parameterName), top: 0, right: 20 },
      xAxis: { type: 'category', data: dateLabels, boundaryGap: false, splitLine: { show: true, lineStyle: { type: 'dashed', color: '#f1f3f5' } } },
      yAxis: paramsToShow.map((_: any, idx: number) => ({
        type: 'value',
        name: idx === 0 ? 'Observed Value' : (idx === 1 && paramsToShow.length === 2 ? 'Observed Value (Right)' : ''),
        show: idx === 0 || (idx === 1 && paramsToShow.length === 2),
        nameTextStyle: { padding: [0, 0, 0, 10] },
        splitLine: { show: idx === 0, lineStyle: { type: 'dashed', color: '#f1f3f5' } },
        scale: true,
      })),
      series,
      color: colors,
    };

    return options;
  };

  const trendChart = buildTrendChart();

  const customerDonut = (() => {
    if (!data?.customerSummary) return null;
    const items: any[] = Object.values(data.customerSummary);
    if (items.length === 0) return null;
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
    return {
      options: {
        tooltip: { trigger: 'item', position: 'inside' },
        series: [{
          type: 'pie',
          radius: ['40%', '75%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          padAngle: 5,
          itemStyle: { borderColor: paperBgColor, borderWidth: 2 },
          label: { show: true, position: 'inside', formatter: '{d}%', fontSize: 11, fontWeight: 600, color: '#fff' },
          labelLine: { show: false },
          data: items.map((c, i) => ({ value: c.total, name: c.name, itemStyle: { color: colors[i % colors.length] } }))
        }],
        legend: { show: true, bottom: 0, left: 'center', type: 'scroll' }
      }
    };
  })();

  const partDonut = (() => {
    if (!data?.partSummary) return null;
    const items: any[] = Object.values(data.partSummary);
    if (items.length === 0) return null;
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
    return {
      options: {
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie',
          radius: ['40%', '75%'],
          center: ['50%', '45%'],
          padAngle: 5,
          avoidLabelOverlap: false,
          itemStyle: { borderColor: paperBgColor, borderWidth: 2 },
          label: { show: true, position: 'inside', formatter: '{d}%', fontSize: 11, fontWeight: 600, color: '#fff' },
          labelLine: { show: false },
          data: items.map((p, i) => ({ value: p.total, name: p.partNumber, itemStyle: { color: colors[i % colors.length] } }))
        }],
        legend: { show: true, bottom: 0, left: 'center', type: 'scroll' }
      }
    };
  })();

  const statusDonut = (() => {
    if (!data) return null;
    const completed = (data.passed || 0) + (data.rejected || 0);
    const pending = (data.pending || 0) + (data.approvalPending || 0);
    const total = completed + pending;
    if (total === 0) return null;
    const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc']
    const items = [
      { name: 'Completed', value: completed },
      { name: 'Pending', value: pending }
    ];
    return {
      options: {
        tooltip: { trigger: 'item' },
        series: [{
          type: 'pie',
          radius: ['40%', '75%'],
          center: ['50%', '45%'],
          padAngle: 5,
          avoidLabelOverlap: false,
          itemStyle: { borderColor: paperBgColor, borderWidth: 2 },
          label: { show: true, position: 'inside', formatter: '{d}%', fontSize: 11, fontWeight: 600, color: '#fff' },
          labelLine: { show: false },
          data: items.map((item, i) => ({ value: item.value, name: item.name, itemStyle: { color: colors[i % colors.length] } }))
        }],
        legend: { show: true, bottom: 0, left: 'center', type: 'scroll' }
      }
    };
  })();


  return (
    <div className="bg-[#f4f7fe] dark:bg-[var(--mantine-color-dark-8)] min-h-[calc(100vh-100px)] rounded-xl border border-transparent dark:border-dark-700 p-4 lg:p-6 transition-colors">
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title order={3} size="h4" className="text-gray-900 dark:text-gray-100 tracking-tight font-display">Dashboard</Title>
          <Text size="sm" c="dimmed" mt={2}>Welcome back, {user?.name || 'Administrator'}</Text>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#1a1b1e] p-2 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
            <Select
              placeholder="All Customers"
              data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
              value={dashboardCustomer}
              onChange={setDashboardCustomer}
              clearable
              size="xs"
              className="w-[150px]"
            />
            <DatePickerInput
              type="range"
              placeholder="Select Date Range"
              value={dashboardDateRange}
              onChange={setDashboardDateRange}
              clearable
              size="xs"
              className="w-[200px]"
            />
            <Button variant="light" size="xs" onClick={() => setShowMachineStats(!showMachineStats)}>
              {showMachineStats ? 'Hide M/C Stats' : 'Show M/C Stats'}
            </Button>
          </div>
        )}
      </div>

      {/* Top Section: High-Density 10-Block Grid */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5, lg: 5 }} spacing="xs" className="mb-4">
        {stats.map((stat, index) => (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: index * 0.05 }} key={index}>
            <MetricCard {...stat} index={index} />
          </motion.div>
        ))}
      </SimpleGrid>

      {user?.role === 'ADMIN' && showMachineStats && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
          <div className="flex items-center gap-4 mb-4 mt-2">
            <Divider className="flex-grow" variant="dashed" />
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" className="tracking-widest">Machine Statistics</Text>
            <Divider className="flex-grow" variant="dashed" />
          </div>

          <SimpleGrid cols={{ base: 2, sm: 3, md: 5, lg: 5 }} spacing="xs" className="mb-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0 * 0.05 }}>
              <MetricCard
                title="Total M/C Configured"
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.totalMcCount || 0}
                color="indigo"
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 1 * 0.05 }}>
              <MetricCard
                title={`Active M/C ${dateLabel}`}
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcCount || 0}
                onClick={() => navigate('/reports?hasMc=true')}
                color="cyan"
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 2 * 0.05 }}>
              <MetricCard
                title="Total M/C Reports"
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcReportsTotal || 0}
                onClick={() => navigate('/reports?hasMc=true&date=today')}
                color="blue"
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 3 * 0.05 }}>
              <MetricCard
                title="M/C Passed"
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcReportsPassed || 0}
                onClick={() => navigate('/reports?hasMc=true&date=today&status=PASSED')}
                color="green"
                isNegative={false}
              />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 4 * 0.05 }}>
              <MetricCard
                title="M/C Failed"
                value={isLoading ? <Skeleton height={24} width={40} /> : data?.machineSummary?.activeMcReportsFailed || 0}
                onClick={() => navigate('/reports?hasMc=true&date=today&status=REJECTED')}
                isNegative={true}
                color="red"
              />
            </motion.div>
          </SimpleGrid>
        </motion.div>
      )}

      {/* Middle Section: 4 Columns */}
      <SimpleGrid cols={{ base: 1, md: 2, xl: 4 }} spacing="lg" className="mb-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.2 }}>
          <Paper withBorder p="md" radius="lg" style={{ height: '100%' }} className="shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <Text size="sm" fw={700}>Customer Share ({dateLabel})</Text>
            </div>
            {isLoading ? (
              <Skeleton height={180} />
            ) : customerDonut ? (
              <div className="flex flex-col justify-between">
                <div className="w-full h-[230px] mb-6">
                  <ReactECharts option={customerDonut.options} style={{ height: '100%', width: '100%' }} />
                </div>

              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-12">No data today</Text>
            )}
          </Paper>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <Paper withBorder p="md" radius="lg" style={{ height: '100%' }} className="shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <Text size="sm" fw={700}>Part Share ({dateLabel})</Text>
            </div>
            {isLoading ? (
              <Skeleton height={180} />
            ) : partDonut ? (
              <div className="flex flex-col justify-between">
                <div className="w-full h-[230px] mb-6">
                  <ReactECharts option={partDonut.options} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-12">No data today</Text>
            )}
          </Paper>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>
          <Paper withBorder p="md" radius="lg" style={{ height: '100%' }} className="shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <Text size="sm" fw={700}>Recent Activity (7 Days up to {dateLabel})</Text>
            </div>
            {isLoading ? (
              <Skeleton height={180} />
            ) : statusDonut ? (
              <div className="flex flex-col justify-between">
                <div className="w-full h-[230px] mb-6">
                  <ReactECharts option={statusDonut.options} style={{ height: '100%', width: '100%' }} />
                </div>
              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-12">No data today</Text>
            )}
          </Paper>
        </motion.div>



        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>
          <Paper withBorder p="md" radius="lg" style={{ height: '100%', minHeight: 260 }} className="shadow-sm flex flex-col">
            <Text size="sm" fw={700} className="mb-4">Recent Activity (7 Days)</Text>
            {isLoading ? (
              <Skeleton height={180} />
            ) : data?.recentActivity ? (
              <div className="w-full flex-grow" style={{ minHeight: 200 }}>
                <ReactECharts
                  option={{
                    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                    legend: { data: ['Passed', 'Rejected'], bottom: 0 },
                    grid: { top: 10, right: 10, bottom: 30, left: 10, containLabel: true },
                    xAxis: { type: 'category', data: data.recentActivity.categories, axisLine: { show: false }, axisTick: { show: false } },
                    yAxis: { type: 'value', show: false },
                    series: [
                      {
                        name: 'Passed', type: 'bar', stack: 'total', barWidth: '45%',
                        itemStyle: {
                          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#40c057' }, { offset: 1, color: '#2b8a3e' }]),
                          borderRadius: [4, 4, 0, 0]
                        },
                        data: data.recentActivity.passed
                      },
                      {
                        name: 'Rejected', type: 'bar', stack: 'total', barWidth: '45%',
                        itemStyle: {
                          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#fa5252' }, { offset: 1, color: '#c92a2a' }]),
                          borderRadius: [4, 4, 0, 0]
                        },
                        data: data.recentActivity.rejected
                      }
                    ]
                  }}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
            ) : (
              <Text c="dimmed" size="sm" className="text-center mt-12">No data</Text>
            )}
          </Paper>
        </motion.div>
      </SimpleGrid>

      {/* Bottom Section: Progress Bars & Large Trend Chart */}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        {/* Status Code Stats equivalent (Shift Progress Bars) */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.5 }}>
          <Paper withBorder p="md" radius="lg" style={{ height: '100%' }} className="shadow-sm">
            <Text size="sm" fw={700} className="mb-4">Shift Status Codes</Text>
            {isLoading ? (
              <div className="space-y-4"><Skeleton height={20} /><Skeleton height={20} /></div>
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
          <Paper withBorder p="md" radius="lg" style={{ height: '100%' }} className="shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <Text size="sm" fw={700}>Parameter Trend Analysis</Text>

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
                <ReactECharts option={trendChart} style={{ height: 260, width: '100%' }} />
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
