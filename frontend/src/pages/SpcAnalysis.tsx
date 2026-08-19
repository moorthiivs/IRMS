import { useState, useRef } from 'react';
import { Title, Paper, Select, Button, Group, Text, SimpleGrid, ActionIcon, Tooltip, Menu, Modal, NumberInput, Badge } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { Download, Printer, Settings as SettingsIcon, FileSpreadsheet, ImageIcon, Maximize, Minimize, Activity, Target, Shield, Sigma } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { masterDataService } from '../services/master-data.service';
import { inspectionService } from '../services/inspection.service';
import { calculateSpcStatistics, SpcResult, calculateXBarRChartStats, XBarRResult } from '../utils/spc';
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

function KpiCard({ icon: Icon, title, value, unit, highlight = false, subtext = '', iconColor = 'blue' }: any) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  };
  const borderClass = highlight ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1b1e]';
  const valColor = highlight ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100';

  return (
    <Paper withBorder p="md" radius="lg" className={`flex items-center gap-4 shadow-sm ${borderClass}`}>
      <div className={`p-3 rounded-xl ${colorMap[iconColor]}`}>
        <Icon size={24} />
      </div>
      <div>
        <Text size="xs" c="dimmed" fw={600}>{title}</Text>
        <div className="flex items-baseline gap-1">
          <Text size="xl" fw={800} className={valColor}>
            {value}
          </Text>
          {unit && <Text size="sm" c="dimmed" className="ml-1">{unit}</Text>}
        </div>
        {subtext && (
          <Text size="xs" fw={600} className={highlight ? 'text-red-500' : 'text-gray-500'}>
            {subtext}
          </Text>
        )}
      </div>
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
  const [customUsl, setCustomUsl] = useState<number | ''>('');
  const [customLsl, setCustomLsl] = useState<number | ''>('');
  const [isFullView, setIsFullView] = useState(false);

  // X-Bar R Chart Settings
  const [chartType, setChartType] = useState<'I' | 'XBAR_R'>('XBAR_R');
  const [subgroupStrategy, setSubgroupStrategy] = useState<'FIXED' | 'SHIFT'>('FIXED');
  const [subgroupSize, setSubgroupSize] = useState<number>(5);

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
  
  const spcStats: SpcResult = calculateSpcStatistics(rawValues, usl, lsl, calcMethod, null);

  const xbarStats: XBarRResult | null = chartType === 'XBAR_R' && !isAttributeMode 
    ? calculateXBarRChartStats(readings, subgroupStrategy, subgroupStrategy === 'FIXED' ? subgroupSize : 'shiftName', usl, lsl) 
    : null;

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
        toolbox: { feature: { dataZoom: {}, restore: {} } },
        grid: { left: '5%', right: '8%', bottom: '10%', top: '15%', containLabel: true },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', start: 0, end: 100 }],
        xAxis: {
          type: 'category',
          data: xAxisLabels,
          boundaryGap: true,
          axisLabel: { formatter: function (value: string) { return value.split(' ')[0]; } }
        },
        yAxis: { type: 'category', data: ['Fail', 'Pass'] },
        series: [{
          name: 'Status',
          type: 'scatter',
          data: dataSeries,
          symbolSize: 12,
          itemStyle: { color: function(params: any) { return params.value === 'Fail' ? '#ef4444' : '#10b981'; } }
        }]
      };
    }

    if (chartType === 'XBAR_R' && xbarStats && xbarStats.subgroups.length > 0) {
      const { subgroups, xDoubleBar, rBar, xBarUcl, xBarLcl, rUcl, rLcl } = xbarStats;
      const xBarData = subgroups.map(sg => sg.xBar);
      const rData = subgroups.map(sg => sg.r);
      const labels = subgroups.map(sg => String(sg.id));

      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
          formatter: function (params: any) {
            const idx = params[0].dataIndex;
            const sg = subgroups[idx];
            let html = `<div style="font-weight:bold;margin-bottom:5px;">Subgroup ${sg.id}</div>`;
            html += `N = ${sg.size}<br/>`;
            html += `Mean: <strong>${sg.xBar.toFixed(4)}</strong><br/>`;
            html += `Range: <strong>${sg.r.toFixed(4)}</strong><br/>`;
            html += `<hr style="margin: 5px 0;" />`;
            html += `<div style="font-size: 11px;">Values: ${sg.readings.map(r => r.value).join(', ')}</div>`;
            return html;
          }
        },
        axisPointer: { link: [{ xAxisIndex: 'all' }] },
        toolbox: { feature: { dataZoom: {}, restore: {} } },
        dataZoom: [
          { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
          { type: 'slider', xAxisIndex: [0, 1], start: 0, end: 100, bottom: 10 }
        ],
        grid: [
          { left: '6%', right: '10%', top: '8%', height: '35%' }, 
          { left: '6%', right: '10%', top: '55%', height: '35%' }
        ],
        xAxis: [
          { gridIndex: 0, type: 'category', data: labels, boundaryGap: true, axisLabel: { show: false } },
          { gridIndex: 1, type: 'category', data: labels, boundaryGap: true, name: 'Subgroup', nameLocation: 'middle', nameGap: 25 }
        ],
        yAxis: [
          { gridIndex: 0, type: 'value', scale: true, name: 'Mean (mm)', nameTextStyle: { color: '#2563eb', fontWeight: 'bold' }, splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } } },
          { gridIndex: 1, type: 'value', scale: true, name: 'Range (mm)', nameTextStyle: { color: '#9333ea', fontWeight: 'bold' }, splitLine: { lineStyle: { type: 'dashed', color: '#f3f4f6' } } }
        ],
        series: [
          {
            name: 'X̄',
            type: 'line',
            xAxisIndex: 0,
            yAxisIndex: 0,
            data: xBarData,
            itemStyle: { color: '#2563eb' },
            symbol: 'circle',
            symbolSize: 6,
            markLine: {
              symbol: ['none', 'none'],
              label: { position: 'end', distance: 10 },
              data: [
                { yAxis: xDoubleBar, lineStyle: { color: '#10b981', type: 'solid' }, label: { formatter: `CL ${xDoubleBar.toFixed(3)}`, color: '#10b981', fontWeight: 'bold' } },
                { yAxis: xBarUcl, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: `UCL ${xBarUcl.toFixed(3)}`, color: '#ef4444', fontWeight: 'bold' } },
                { yAxis: xBarLcl, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: `LCL ${xBarLcl.toFixed(3)}`, color: '#ef4444', fontWeight: 'bold' } }
              ]
            }
          },
          {
            name: 'R',
            type: 'line',
            xAxisIndex: 1,
            yAxisIndex: 1,
            data: rData,
            itemStyle: { color: '#9333ea' },
            symbol: 'circle',
            symbolSize: 6,
            markLine: {
              symbol: ['none', 'none'],
              label: { position: 'end', distance: 10 },
              data: [
                { yAxis: rBar, lineStyle: { color: '#10b981', type: 'solid' }, label: { formatter: `CL ${rBar.toFixed(3)}`, color: '#10b981', fontWeight: 'bold' } },
                { yAxis: rUcl, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: `UCL ${rUcl.toFixed(3)}`, color: '#ef4444', fontWeight: 'bold' } },
                { yAxis: rLcl, lineStyle: { color: '#ef4444', type: 'dashed' }, label: { formatter: `LCL ${rLcl.toFixed(3)}`, color: '#ef4444', fontWeight: 'bold' } }
              ]
            }
          }
        ]
      };
    }

    // Original I-Chart Option
    const dataSeries = readings.map(r => r.value);
    const markLines: any[] = [];
    markLines.push({ yAxis: spcStats.cl, lineStyle: { color: '#10b981', type: 'solid', width: 2 }, label: { formatter: `Mean (${spcStats.cl.toFixed(4)})`, position: 'end' } });
    markLines.push({ yAxis: spcStats.ucl, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: `UCL (${spcStats.ucl.toFixed(4)})`, position: 'insideEndTop' } });
    markLines.push({ yAxis: spcStats.lcl, lineStyle: { color: '#f59e0b', type: 'dashed' }, label: { formatter: `LCL (${spcStats.lcl.toFixed(4)})`, position: 'insideEndBottom' } });
    if (usl !== null) markLines.push({ yAxis: usl, lineStyle: { color: '#ef4444', type: 'solid' }, label: { formatter: `USL (${Number(usl).toFixed(4)})`, position: 'insideStartTop' } });
    if (lsl !== null) markLines.push({ yAxis: lsl, lineStyle: { color: '#ef4444', type: 'solid' }, label: { formatter: `LSL (${Number(lsl).toFixed(4)})`, position: 'insideStartBottom' } });

    return {
      title: { text: activeParam ? `${activeParam.parameterName} I-Chart` : 'I-Chart', left: 'center' },
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
          html += `Mean: ${spcStats.cl.toFixed(4)}<br/>`;
          html += `UCL: ${spcStats.ucl.toFixed(4)} &nbsp;|&nbsp; LCL: ${spcStats.lcl.toFixed(4)}<br/>`;
          html += `USL: ${usl !== null ? Number(usl).toFixed(4) : 'N/A'} &nbsp;|&nbsp; LSL: ${lsl !== null ? Number(lsl).toFixed(4) : 'N/A'}`;
          html += `</div>`;
          return html;
        }
      },
      toolbox: { feature: { dataZoom: {}, restore: {} } },
      grid: { left: '5%', right: '12%', bottom: '10%', top: '15%', containLabel: true },
      dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', start: 0, end: 100 }],
      xAxis: { type: 'category', data: xAxisLabels, boundaryGap: false, axisLabel: { formatter: function (value: string) { return value.split(' ')[0]; } } },
      yAxis: {
        type: 'value',
        scale: true,
        axisLabel: { formatter: function (value: number) { return parseFloat(value.toFixed(4)); } },
        min: function (value: any) {
          const limits = [value.min];
          if (lsl !== null) limits.push(lsl);
          if (spcStats.lcl !== undefined) limits.push(spcStats.lcl);
          const min = Math.min(...limits);
          return min - Math.abs(min * 0.005);
        },
        max: function (value: any) {
          const limits = [value.max];
          if (usl !== null) limits.push(usl);
          if (spcStats.ucl !== undefined) limits.push(spcStats.ucl);
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
          markLine: { symbol: ['none', 'none'], data: markLines, animation: false }
        }
      ]
    };
  };

  const exportToExcel = () => {
    if (readings.length === 0) return;
    
    let wsData = [];
    if (chartType === 'XBAR_R' && xbarStats) {
      wsData = xbarStats.subgroups.map((sg) => ({
        'Subgroup': sg.id,
        'Size': sg.size,
        'Mean (X-bar)': sg.xBar,
        'Range (R)': sg.r,
        'Values': sg.readings.map(r => r.value).join(', ')
      }));
    } else {
      wsData = readings.map((r, i) => ({
        '#': i + 1,
        'Date': r.date,
        'Time': new Date(r.timestamp).toLocaleTimeString(),
        'Shift': r.shiftName,
        'Interval': r.interval,
        'Value': r.value
      }));
    }
    
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

  const handlePrint = () => { window.print(); };

  return (
    <div className="bg-[#f4f7fe] dark:bg-[var(--mantine-color-dark-8)] min-h-[calc(100vh-100px)] rounded-xl p-4 lg:p-6 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4 print:hidden">
        <div>
          <Title order={2} size="h3">Statistical Process Control (SPC)</Title>
          <Text c="dimmed" size="sm">Monitor Process Stability and Variation</Text>
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
          {chartType === 'XBAR_R' && !isAttributeMode && xbarStats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              <KpiCard icon={Activity} iconColor="blue" title="Process Mean (X̄)" value={xbarStats.xDoubleBar.toFixed(3)} />
              <KpiCard icon={Activity} iconColor="purple" title="Avg Range (R̄)" value={xbarStats.rBar.toFixed(3)} />
              <KpiCard icon={Target} iconColor={xbarStats.cp !== null && xbarStats.cp < 1.33 ? "red" : "blue"} highlight={xbarStats.cp !== null && xbarStats.cp < 1.33} title="Cp" value={xbarStats.cp ? xbarStats.cp.toFixed(2) : 'N/A'} subtext={xbarStats.cp !== null && xbarStats.cp < 1.33 ? "(< 1.33)" : ""} />
              <KpiCard icon={Shield} iconColor={xbarStats.cpk !== null && xbarStats.cpk < 1.33 ? "red" : "blue"} highlight={xbarStats.cpk !== null && xbarStats.cpk < 1.33} title="Cpk" value={xbarStats.cpk ? xbarStats.cpk.toFixed(2) : 'N/A'} subtext={xbarStats.cpk !== null && xbarStats.cpk < 1.33 ? "(< 1.33)" : ""} />
              <KpiCard icon={Sigma} iconColor="blue" title="Process Sigma (σ)" value={xbarStats.sigma.toFixed(3)} subtext="(estimated)" />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            <div className={isFullView ? "lg:col-span-4" : "lg:col-span-3"}>
              <Paper withBorder p="md" radius="lg" className="h-[650px] shadow-sm relative pt-12">
                {chartType === 'XBAR_R' && !isAttributeMode && (
                  <>
                    <Badge size="lg" radius="xl" color="blue" variant="filled" className="absolute top-4 left-1/2 -translate-x-1/2 z-10 shadow-sm">
                      X̄ - BAR CHART (Sample Mean)
                    </Badge>
                    <Badge size="lg" radius="xl" color="grape" variant="filled" className="absolute top-[52%] left-1/2 -translate-x-1/2 z-10 shadow-sm">
                      R - BAR CHART (Sample Range)
                    </Badge>
                  </>
                )}
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
                  <Paper withBorder p="sm" radius="md" className={yieldPct < 95 ? 'bg-red-50 border-red-300' : 'bg-blue-50 border-blue-300'}>
                    <Text size="sm" fw={700} className={yieldPct < 95 ? 'text-red-700' : 'text-blue-700'}>Yield: {yieldPct.toFixed(1)}%</Text>
                  </Paper>
                );
              })() : spcStats.cpk !== null && (
                <Paper withBorder p="sm" radius="md" className={spcStats.cpk < 1.33 ? 'bg-amber-50 border-amber-300' : 'bg-emerald-50 border-emerald-300'}>
                    <div className="flex gap-2 items-center">
                      <Text size="sm" fw={700}>{spcStats.cpk < 1.0 ? 'Incapable' : spcStats.cpk < 1.33 ? 'Needs Improvement' : 'Capable'}</Text>
                    </div>
                </Paper>
              )}
                {chartType === 'XBAR_R' && xbarStats ? (
                  <SimpleGrid cols={2} spacing="md">
                    <StatCard title="Subgroups" value={xbarStats.subgroups.length} />
                    <StatCard title="Total N" value={readings.length} />
                    <StatCard title="X-bar UCL" value={xbarStats.xBarUcl.toFixed(3)} />
                    <StatCard title="X-bar LCL" value={xbarStats.xBarLcl.toFixed(3)} />
                    <StatCard title="R UCL" value={xbarStats.rUcl.toFixed(3)} />
                    <StatCard title="R LCL" value={xbarStats.rLcl.toFixed(3)} />
                  </SimpleGrid>
                ) : (
                  <SimpleGrid cols={2} spacing="md">
                    <StatCard title="Cp" value={spcStats.cp ? spcStats.cp.toFixed(3) : 'N/A'} />
                    <StatCard title="Cpk" value={spcStats.cpk ? spcStats.cpk.toFixed(3) : 'N/A'} />
                    <StatCard title="Mean (X̄)" value={spcStats.mean.toFixed(3)} />
                    <StatCard title="Std Dev (σ)" value={spcStats.sigma.toFixed(4)} />
                    <StatCard title="UCL" value={spcStats.ucl.toFixed(3)} />
                    <StatCard title="LCL" value={spcStats.lcl.toFixed(3)} />
                  </SimpleGrid>
                )}
              </div>
            )}
          </div>

          <Modal opened={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Chart Configuration & Calculations" centered size="lg">
            <div className="space-y-4">
              <Select
                label="Chart Type"
                data={[
                  { value: 'XBAR_R', label: 'X-bar & R Chart (Professional)' },
                  { value: 'I', label: 'Individuals Chart (Classic)' }
                ]}
                value={chartType}
                onChange={(v) => setChartType(v as any)}
                disabled={isAttributeMode}
              />
              
              {chartType === 'XBAR_R' && !isAttributeMode && (
                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-md border border-blue-100 dark:border-blue-900 mb-4">
                  <Select
                    label="Subgroup Strategy"
                    data={[
                      { value: 'FIXED', label: 'Fixed Size (Consecutive Parts)' },
                      { value: 'SHIFT', label: 'Group By Shift' }
                    ]}
                    value={subgroupStrategy}
                    onChange={(v) => setSubgroupStrategy(v as any)}
                    mb="sm"
                  />
                  {subgroupStrategy === 'FIXED' && (
                    <NumberInput
                      label="Subgroup Size (n)"
                      description="Usually between 2 and 5"
                      min={2}
                      max={10}
                      value={subgroupSize}
                      onChange={(v) => setSubgroupSize(v as number)}
                    />
                  )}
                </div>
              )}

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
              </SimpleGrid>

              {chartType === 'I' && (
                <Select
                  label="Control Limit Calculation"
                  data={[
                    { value: 'STATISTICAL', label: 'Statistical Limits (Mean ± 3σ)' },
                    { value: 'FIXED', label: 'Fixed Tolerance (70% of Spec Band)' }
                  ]}
                  value={calcMethod}
                  onChange={(v) => setCalcMethod(v as any)}
                />
              )}
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
