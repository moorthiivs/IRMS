import { useState, useRef } from 'react';
import { Title, Paper, Select, Button, Group, Text, SimpleGrid, Switch, ActionIcon, Tooltip, Menu, Modal, NumberInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { Download, Printer, Settings as SettingsIcon, FileSpreadsheet, ImageIcon, CheckCircle2, XCircle, Maximize, Minimize, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { masterDataService } from '../services/master-data.service';
import { inspectionService } from '../services/inspection.service';
import { calculateSpcStatistics, SpcResult } from '../utils/spc';
import * as XLSX from 'xlsx';

function StatCard({ title, value, unit = '' }: { title: string; value: string | number; unit?: string }) {
  return (
    <Paper withBorder p="sm" radius="md" className="bg-white dark:bg-[#1a1b1e]">
      <Text size="xs" c="dimmed" fw={600} tt="uppercase">{title}</Text>
      <Text size="xl" fw={700} className="text-gray-900 dark:text-gray-100">
        {value} {unit && <span className="text-sm text-gray-500 font-normal">{unit}</span>}
      </Text>
    </Paper>
  );
}

export function SpcAnalysis() {
  const [searchParams] = useSearchParams();
  const echartRef = useRef<ReactECharts>(null);

  // Filters State
  const [selectedPart, setSelectedPart] = useState<string | null>(searchParams.get('partId') || null);
  const [selectedOp, setSelectedOp] = useState<string | null>(searchParams.get('opId') || null);
  const [selectedParam, setSelectedParam] = useState<string | null>(searchParams.get('paramId') || null);
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [calcMethod, setCalcMethod] = useState<'STATISTICAL' | 'FIXED'>('STATISTICAL');
  const [showUclLcl, setShowUclLcl] = useState(true);
  const [showSpecLimits, setShowSpecLimits] = useState(true);
  const [showMean, setShowMean] = useState(true);
  const [customUsl, setCustomUsl] = useState<number | ''>('');
  const [customLsl, setCustomLsl] = useState<number | ''>('');
  const [customSigma, setCustomSigma] = useState<number | ''>('');
  const [isFullView, setIsFullView] = useState(false);

  // Queries
  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
  });

  const { data: operations = [] } = useQuery({
    queryKey: ['operations', selectedPart],
    queryFn: () => masterDataService.getOperationsByPart(selectedPart!),
    enabled: !!selectedPart,
  });

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', selectedPart, selectedOp],
    queryFn: () => masterDataService.getParameters(selectedPart!, selectedOp!),
    enabled: !!selectedPart && !!selectedOp,
  });

  const { data: trendData } = useQuery({
    queryKey: ['trends', 'v2', selectedPart, selectedOp, dateRange],
    queryFn: () => {
      const params: any = { partId: selectedPart!, operationId: selectedOp! };
      if (dateRange[0] && dateRange[1]) {
        params.startDate = `${dateRange[0].getFullYear()}-${String(dateRange[0].getMonth() + 1).padStart(2, '0')}-${String(dateRange[0].getDate()).padStart(2, '0')}`;
        params.endDate = `${dateRange[1].getFullYear()}-${String(dateRange[1].getMonth() + 1).padStart(2, '0')}-${String(dateRange[1].getDate()).padStart(2, '0')}`;
      } else {
        params.days = 30; // Max default to 30 days
      }
      return inspectionService.getTrends(params);
    },
    enabled: !!selectedPart && !!selectedOp,
  });

  const activeParam = parameters.find((p: any) => p.id === selectedParam);
  
  // Extract all individual readings across the date range for the selected parameter
  const extractReadings = () => {
    if (!trendData || !selectedParam || !trendData.parameters) return { readings: [], isAttributeMode: false };
    const paramData = trendData.parameters.find((p: any) => p.parameterId === selectedParam);
    if (!paramData || !paramData.daily) return { readings: [], isAttributeMode: false };

    let allReadings: any[] = [];
    let hasNonNumeric = false;
    trendData.dateLabels.forEach((dateStr: string, index: number) => {
      const dailyObj = paramData.daily[index];
      if (dailyObj && dailyObj.readings && dailyObj.readings.length > 0) {
        dailyObj.readings.forEach((r: any) => {
          const parsed = parseFloat(r.value);
          const rawStr = String(r.value || '').trim();
          if (isNaN(parsed) && rawStr !== '') {
            hasNonNumeric = true;
          }
          allReadings.push({
            date: dateStr,
            rawValue: r.value,
            value: parsed,
            timestamp: r.timestamp,
            shiftName: r.shiftName,
            interval: r.interval
          });
        });
      }
    });
    // Sort by timestamp
    allReadings.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    if (hasNonNumeric) {
      return { readings: allReadings, isAttributeMode: true };
    }
    
    return { readings: allReadings.filter(r => !isNaN(r.value)), isAttributeMode: false };
  };

  const { readings, isAttributeMode } = extractReadings();
  const rawValues = readings.map(r => r.value);
  
  const usl = customUsl !== '' ? customUsl : (activeParam?.controlLimitMax !== undefined ? activeParam.controlLimitMax : null);
  const lsl = customLsl !== '' ? customLsl : (activeParam?.controlLimitMin !== undefined ? activeParam.controlLimitMin : null);
  
  const spcStats: SpcResult = calculateSpcStatistics(rawValues, usl, lsl, calcMethod, customSigma !== '' ? customSigma : null);

  // ECharts Option Builder
  const buildChartOption = () => {
    if (readings.length === 0) return {};

    const xAxisLabels = readings.map((r) => `${r.date} ${new Date(r.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`);

    if (isAttributeMode) {
      const dataSeries = readings.map(r => {
        const val = String(r.rawValue).trim().toLowerCase();
        const isFail = val === 'ng' || val === 'fail' || val === 'not ok' || val === 'not okay' || val === 'nok';
        return isFail ? 'Fail' : 'Pass';
      });

      return {
        title: { text: activeParam ? `${activeParam.parameterName} Attribute Chart` : 'Attribute Chart', left: 'center' },
        tooltip: {
          trigger: 'item',
          formatter: function (params: any) {
            const r = readings[params.dataIndex];
            return `
              <div style="font-weight:bold;margin-bottom:5px;">${r.date}</div>
              Shift: ${r.shiftName} - ${r.interval}<br/>
              Time: ${new Date(r.timestamp).toLocaleTimeString()}<br/>
              <strong>Status: ${r.rawValue}</strong>
            `;
          }
        },
        toolbox: {
          feature: {
            dataZoom: {},
            restore: {},
          }
        },
        grid: { left: '5%', right: '8%', bottom: '10%', top: '15%', containLabel: true },
        dataZoom: [
          { type: 'inside', start: 0, end: 100 },
          { type: 'slider', start: 0, end: 100 }
        ],
        xAxis: {
          type: 'category',
          data: xAxisLabels,
          boundaryGap: true,
          axisLabel: {
            formatter: function (value: string) {
              return value.split(' ')[0];
            }
          }
        },
        yAxis: {
          type: 'category',
          data: ['Fail', 'Pass']
        },
        series: [
          {
            name: 'Status',
            type: 'scatter',
            data: dataSeries,
            symbolSize: 12,
            itemStyle: {
              color: function(params: any) {
                return params.value === 'Fail' ? '#ef4444' : '#10b981';
              }
            }
          }
        ]
      };
    }

    const dataSeries = readings.map(r => r.value);

    const markLines: any[] = [];
    
    if (showMean) {
      markLines.push({ yAxis: spcStats.cl, lineStyle: { color: '#10b981', type: 'solid', width: 2 }, label: { formatter: `Mean (${spcStats.cl.toFixed(4)})`, position: 'end' } });
    }
    if (showUclLcl) {
      markLines.push({ yAxis: spcStats.ucl, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: `UCL (${spcStats.ucl.toFixed(4)})`, position: 'insideEndTop' } });
      markLines.push({ yAxis: spcStats.lcl, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: `LCL (${spcStats.lcl.toFixed(4)})`, position: 'insideEndBottom' } });
    }
    if (showSpecLimits) {
      if (usl !== null) markLines.push({ yAxis: usl, lineStyle: { color: '#ef4444', type: 'solid' }, label: { formatter: `USL (${Number(usl).toFixed(4)})`, position: 'insideStartTop' } });
      if (lsl !== null) markLines.push({ yAxis: lsl, lineStyle: { color: '#ef4444', type: 'solid' }, label: { formatter: `LSL (${Number(lsl).toFixed(4)})`, position: 'insideStartBottom' } });
    }

    return {
      title: { text: activeParam ? `${activeParam.parameterName} SPC Chart` : 'SPC Chart', left: 'center' },
      tooltip: {
        trigger: 'axis',
        formatter: function (params: any) {
          const idx = params[0].dataIndex;
          const r = readings[idx];
          let html = `
            <div style="font-weight:bold;margin-bottom:5px;">${r.date}</div>
            Shift: ${r.shiftName} - ${r.interval}<br/>
            Time: ${new Date(r.timestamp).toLocaleTimeString()}<br/>
            <strong>Value: ${r.value}</strong>
            <hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;" />
            <div style="font-size: 11px; color: #666; line-height: 1.4;">
          `;
          if (showMean) html += `Mean: ${spcStats.cl.toFixed(4)}<br/>`;
          if (showUclLcl) html += `UCL: ${spcStats.ucl.toFixed(4)} &nbsp;|&nbsp; LCL: ${spcStats.lcl.toFixed(4)}<br/>`;
          if (showSpecLimits) html += `USL: ${usl !== null ? Number(usl).toFixed(4) : 'N/A'} &nbsp;|&nbsp; LSL: ${lsl !== null ? Number(lsl).toFixed(4) : 'N/A'}`;
          html += `</div>`;
          return html;
        }
      },
      toolbox: {
        feature: {
          dataZoom: {},
          restore: {},
        }
      },
      grid: { left: '5%', right: '12%', bottom: '10%', top: '15%', containLabel: true },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100 }
      ],
      xAxis: {
        type: 'category',
        data: xAxisLabels,
        boundaryGap: false,
        axisLabel: {
          formatter: function (value: string) {
            return value.split(' ')[0]; // Just show date on axis to save space
          }
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: {
          formatter: function (value: number) {
            return parseFloat(value.toFixed(4));
          }
        },
        min: function (value: any) {
          const limits = [value.min];
          if (showSpecLimits && lsl !== null) limits.push(lsl);
          if (showUclLcl && spcStats.lcl !== undefined) limits.push(spcStats.lcl);
          const min = Math.min(...limits);
          return min - Math.abs(min * 0.005);
        },
        max: function (value: any) {
          const limits = [value.max];
          if (showSpecLimits && usl !== null) limits.push(usl);
          if (showUclLcl && spcStats.ucl !== undefined) limits.push(spcStats.ucl);
          const max = Math.max(...limits);
          return max + Math.abs(max * 0.005);
        },
        splitLine: { lineStyle: { type: 'dashed' } }
      },
      series: [
        {
          name: 'Observed Value',
          type: 'line',
          data: dataSeries,
          symbol: 'circle',
          symbolSize: 6,
          itemStyle: { color: '#3b82f6' },
          lineStyle: { width: 2 },
          markLine: {
            symbol: ['none', 'none'],
            data: markLines,
            animation: false
          }
        }
      ]
    };
  };

  const exportToExcel = () => {
    if (readings.length === 0) return;
    const wsData = readings.map((r, i) => ({
      '#': i + 1,
      'Date': r.date,
      'Time': new Date(r.timestamp).toLocaleTimeString(),
      'Shift': r.shiftName,
      'Interval': r.interval,
      'Value': r.value
    }));
    
    // Add stats summary rows at bottom
    wsData.push({ '#' : '', 'Date': '', 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);
    wsData.push({ '#' : 'STATISTICS', 'Date': '', 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);
    wsData.push({ '#' : 'Mean', 'Date': spcStats.mean.toFixed(4), 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);
    wsData.push({ '#' : 'StdDev (σ)', 'Date': spcStats.sigma.toFixed(4), 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);
    wsData.push({ '#' : 'Cp', 'Date': spcStats.cp ? spcStats.cp.toFixed(3) : 'N/A', 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);
    wsData.push({ '#' : 'Cpk', 'Date': spcStats.cpk ? spcStats.cpk.toFixed(3) : 'N/A', 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);
    wsData.push({ '#' : 'UCL', 'Date': spcStats.ucl.toFixed(4), 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);
    wsData.push({ '#' : 'LCL', 'Date': spcStats.lcl.toFixed(4), 'Time': '', 'Shift': '', 'Interval': '', 'Value': '' } as any);

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SPC_Data');
    XLSX.writeFile(wb, `SPC_Report_${activeParam?.parameterName || 'Param'}_${new Date().getTime()}.xlsx`);
  };

  const exportToImage = () => {
    if (echartRef.current) {
      const echartInstance = echartRef.current.getEchartsInstance();
      const base64 = echartInstance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
      const a = document.createElement('a');
      a.download = `SPC_Chart_${new Date().getTime()}.png`;
      a.href = base64;
      a.click();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#f4f7fe] dark:bg-[var(--mantine-color-dark-8)] min-h-[calc(100vh-100px)] rounded-xl p-4 lg:p-6 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 print:hidden">
        <div>
          <Title order={2} size="h3">Statistical Process Control (SPC)</Title>
          <Text c="dimmed" size="sm">Analyze parameter trends and statistical capabilities</Text>
        </div>
        
        <Group>
          <Button variant="light" leftSection={<Printer size={16} />} onClick={handlePrint}>Print</Button>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button leftSection={<Download size={16} />}>Export</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<ImageIcon size={14} />} onClick={exportToImage}>Export as PNG</Menu.Item>
              <Menu.Item leftSection={<FileSpreadsheet size={14} />} onClick={exportToExcel}>Export as Excel</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Tooltip label={isFullView ? "Show Summary" : "Full View Chart"}>
            <ActionIcon variant={isFullView ? "filled" : "light"} size="lg" onClick={() => setIsFullView(!isFullView)} color={isFullView ? "blue" : "gray"}>
              {isFullView ? <Minimize size={20} /> : <Maximize size={20} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Chart Configuration">
            <ActionIcon variant="light" size="lg" onClick={() => setIsSettingsOpen(true)}>
              <SettingsIcon size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </div>

      <Paper withBorder p="md" radius="lg" className="mb-6 shadow-sm print:hidden">
        <div className="flex flex-wrap gap-4 items-end">
          <Select
            label="Part Number"
            placeholder="Select Part"
            searchable
            data={parts.map(p => ({ value: p.id, label: p.partNumber }))}
            value={selectedPart}
            onChange={(v) => { setSelectedPart(v); setSelectedOp(null); setSelectedParam(null); }}
            className="w-full sm:w-[200px]"
          />
          <Select
            label="Operation"
            placeholder="Select Op"
            disabled={!selectedPart}
            data={operations.map((o: any) => ({ value: o.id, label: o.operationNumber }))}
            value={selectedOp}
            onChange={(v) => { setSelectedOp(v); setSelectedParam(null); }}
            className="w-full sm:w-[150px]"
          />
          <Select
            label="Parameter"
            placeholder="Select Parameter"
            searchable
            disabled={!selectedOp}
            data={parameters.map((p: any) => ({ value: p.id, label: p.parameterName }))}
            value={selectedParam}
            onChange={setSelectedParam}
            className="w-full sm:w-[250px]"
          />
          <DatePickerInput
            type="range"
            label="Date Range (Max 30 days)"
            placeholder="Pick dates"
            value={dateRange}
            onChange={setDateRange}
            clearable
            maxDate={new Date()}
            className="w-full sm:w-[250px]"
          />
        </div>
      </Paper>

      {selectedParam && trendData ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <div className={isFullView ? "lg:col-span-4" : "lg:col-span-3"}>
              <Paper withBorder p="md" radius="lg" className="h-[500px] shadow-sm">
                <ReactECharts
                  ref={echartRef}
                  option={buildChartOption()}
                  style={{ height: '100%', width: '100%' }}
                  notMerge={true}
                />
              </Paper>
            </div>
            {!isFullView && (
              <div className="lg:col-span-1 flex flex-col gap-4">
              <Title order={4} className="mb-0">Statistical Summary</Title>
              
              {isAttributeMode ? (() => {
                const totalN = readings.length;
                const passed = readings.filter(r => {
                  const val = String(r.rawValue).trim().toLowerCase();
                  return !(val === 'ng' || val === 'fail' || val === 'not ok' || val === 'not okay' || val === 'nok');
                }).length;
                const yieldPct = totalN > 0 ? (passed / totalN) * 100 : 0;
                
                return (
                  <Paper 
                    withBorder 
                    p="sm" 
                    radius="md" 
                    className={
                      yieldPct < 95 ? 'bg-red-50 dark:bg-red-900/20 border-red-300' :
                      yieldPct < 99.9 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300' :
                      'bg-blue-50 dark:bg-blue-900/20 border-blue-300'
                    }
                  >
                    <div className={`flex gap-2 items-center ${
                      yieldPct < 95 ? 'text-red-700 dark:text-red-400' :
                      yieldPct < 99.9 ? 'text-amber-700 dark:text-amber-400' :
                      'text-blue-700 dark:text-blue-400'
                    }`}>
                      {yieldPct < 95 ? <XCircle size={18} /> : yieldPct < 99.9 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                      <Text size="sm" fw={700}>
                        {yieldPct < 95 ? 'Fail (High Defect Rate)' : yieldPct < 99.9 ? 'Good (Minor Defects)' : 'Excellent (Zero Defects)'}
                      </Text>
                    </div>
                    <Text size="xs" mt={4} className={
                      yieldPct < 95 ? 'text-red-600 dark:text-red-300' :
                      yieldPct < 99.9 ? 'text-amber-700 dark:text-amber-300' :
                      'text-blue-600 dark:text-blue-300'
                    }>
                      {yieldPct < 95 
                        ? 'Process yield is below 95%. Immediate action required.' 
                        : yieldPct < 99.9 
                        ? 'Process yield is good but experiencing some defects.' 
                        : 'Process is operating perfectly with 100% yield.'}
                    </Text>
                  </Paper>
                );
              })() : spcStats.cpk !== null && (
                <Paper 
                  withBorder 
                  p="sm" 
                  radius="md" 
                  className={
                    spcStats.cpk < 1.0 ? 'bg-red-50 dark:bg-red-900/20 border-red-300' :
                    spcStats.cpk < 1.33 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300' :
                    spcStats.cpk < 1.67 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300' :
                    'bg-blue-50 dark:bg-blue-900/20 border-blue-300'
                  }
                >
                  <div className={`flex gap-2 items-center ${
                    spcStats.cpk < 1.0 ? 'text-red-700 dark:text-red-400' :
                    spcStats.cpk < 1.33 ? 'text-amber-700 dark:text-amber-400' :
                    spcStats.cpk < 1.67 ? 'text-emerald-700 dark:text-emerald-400' :
                    'text-blue-700 dark:text-blue-400'
                  }`}>
                    {spcStats.cpk < 1.0 ? <XCircle size={18} /> : spcStats.cpk < 1.33 ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    <Text size="sm" fw={700}>
                      {spcStats.cpk < 1.0 ? 'Fail (Incapable)' : spcStats.cpk < 1.33 ? 'Average (Needs Improvement)' : spcStats.cpk < 1.67 ? 'Good (Capable)' : 'Excellent (Highly Capable)'}
                    </Text>
                  </div>
                  <Text size="xs" mt={4} className={
                    spcStats.cpk < 1.0 ? 'text-red-600 dark:text-red-300' :
                    spcStats.cpk < 1.33 ? 'text-amber-700 dark:text-amber-300' :
                    spcStats.cpk < 1.67 ? 'text-emerald-600 dark:text-emerald-300' :
                    'text-blue-600 dark:text-blue-300'
                  }>
                    {spcStats.cpk < 1.0 
                      ? 'Cpk < 1.00. Process variation is wider than specification limits.' 
                      : spcStats.cpk < 1.33 
                      ? '1.00 ≤ Cpk < 1.33. Barely capable; variation should be reduced.' 
                      : spcStats.cpk < 1.67
                      ? '1.33 ≤ Cpk < 1.67. Meets quality requirements and is well centered.'
                      : 'Cpk ≥ 1.67. Outstanding quality with very low defect rate.'}
                  </Text>
                </Paper>
              )}

              {isAttributeMode ? (
                <SimpleGrid cols={2} spacing="md">
                  <StatCard title="Total Sample N" value={readings.length} />
                  <StatCard title="Total Passed" value={readings.filter(r => {
                    const val = String(r.rawValue).trim().toLowerCase();
                    return !(val === 'ng' || val === 'fail' || val === 'not ok' || val === 'not okay' || val === 'nok');
                  }).length} />
                  <StatCard title="Total Failed" value={readings.filter(r => {
                    const val = String(r.rawValue).trim().toLowerCase();
                    return (val === 'ng' || val === 'fail' || val === 'not ok' || val === 'not okay' || val === 'nok');
                  }).length} />
                  <StatCard title="Yield (FPY)" value={`${(readings.length > 0 ? (readings.filter(r => {
                    const val = String(r.rawValue).trim().toLowerCase();
                    return !(val === 'ng' || val === 'fail' || val === 'not ok' || val === 'not okay' || val === 'nok');
                  }).length / readings.length) * 100 : 0).toFixed(1)}%`} />
                  <StatCard title="Defect Rate" value={`${(readings.length > 0 ? (readings.filter(r => {
                    const val = String(r.rawValue).trim().toLowerCase();
                    return (val === 'ng' || val === 'fail' || val === 'not ok' || val === 'not okay' || val === 'nok');
                  }).length / readings.length) * 100 : 0).toFixed(1)}%`} />
                </SimpleGrid>
              ) : (
                <SimpleGrid cols={2} spacing="md">
                  <StatCard title="Cp" value={spcStats.cp ? spcStats.cp.toFixed(3) : 'N/A'} />
                  <StatCard title="Cpk" value={spcStats.cpk ? spcStats.cpk.toFixed(3) : 'N/A'} />
                  <StatCard title="Mean (X̄)" value={spcStats.mean.toFixed(3)} />
                  <StatCard title="Std Dev (σ)" value={spcStats.sigma.toFixed(4)} />
                  <StatCard title="UCL" value={spcStats.ucl.toFixed(3)} />
                  <StatCard title="LCL" value={spcStats.lcl.toFixed(3)} />
                  <StatCard title="Max" value={spcStats.max} />
                  <StatCard title="Min" value={spcStats.min} />
                  <StatCard title="Sample N" value={spcStats.n} />
                </SimpleGrid>
              )}
              </div>
            )}
          </div>

          <Modal opened={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Chart Configuration & Calculations" centered size="lg">
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                <Text fw={600} size="sm" mb="xs">Cp & Cpk Formulas</Text>
                <Text size="xs" className="font-mono text-gray-700 dark:text-gray-300">
                  Cp = (USL - LSL) / 6σ<br/>
                  Cpk = min( (USL - Mean) / 3σ, (Mean - LSL) / 3σ )
                </Text>
              </div>

              <Text fw={600} size="sm" mt="md">Overrides & Customization</Text>
              <SimpleGrid cols={2} spacing="md">
                <NumberInput
                  label="Custom USL"
                  placeholder={activeParam?.controlLimitMax?.toString() || 'USL'}
                  value={customUsl}
                  onChange={(v) => setCustomUsl(v as number | '')}
                />
                <NumberInput
                  label="Custom LSL"
                  placeholder={activeParam?.controlLimitMin?.toString() || 'LSL'}
                  value={customLsl}
                  onChange={(v) => setCustomLsl(v as number | '')}
                />
                <NumberInput
                  label="Custom Sigma (σ)"
                  placeholder="Calculated automatically"
                  value={customSigma}
                  onChange={(v) => setCustomSigma(v as number | '')}
                  decimalScale={6}
                />
              </SimpleGrid>

              <Select
                label="Control Limit Calculation"
                description="Choose how UCL and LCL are calculated"
                data={[
                  { value: 'STATISTICAL', label: 'Statistical Limits (Mean ± 3σ)' },
                  { value: 'FIXED', label: 'Fixed Tolerance (70% of Spec Band)' }
                ]}
                value={calcMethod}
                onChange={(v) => setCalcMethod(v as any)}
              />
              
              <div className="border-t border-gray-200 dark:border-gray-800 pt-4 mt-4">
                <Text fw={600} size="sm" mb="md">Display Options</Text>
                <Switch 
                  label="Show Statistical Mean (Center Line)" 
                  checked={showMean} 
                  onChange={(e) => setShowMean(e.currentTarget.checked)} 
                  mb="sm"
                />
                <Switch 
                  label="Show Control Limits (UCL / LCL)" 
                  checked={showUclLcl} 
                  onChange={(e) => setShowUclLcl(e.currentTarget.checked)} 
                  mb="sm"
                />
                <Switch 
                  label="Show Specification Limits (USL / LSL)" 
                  checked={showSpecLimits} 
                  onChange={(e) => setShowSpecLimits(e.currentTarget.checked)} 
                />
              </div>
            </div>
          </Modal>
        </>
      ) : (
        <Paper withBorder p="xl" radius="lg" className="flex flex-col items-center justify-center h-[400px]">
          <Text c="dimmed" size="lg">Select a Part, Operation, and Parameter to view SPC Analysis.</Text>
        </Paper>
      )}
    </div>
  );
}
