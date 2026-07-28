import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Group, Text, Paper, Table, Badge, Loader, Center } from '@mantine/core';
import { ArrowLeft, Download } from 'lucide-react';
import { inspectionService } from '../services/inspection.service';
import { masterDataService } from '../services/master-data.service';
import { settingsService } from '../services/settings.service';
import { notifications } from '@mantine/notifications';

export function DailyReportFullView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const partId = searchParams.get('partId') || '';
  const opId = searchParams.get('opId') || '';
  const mcNo = searchParams.get('mcNo') || '';
  const dateParam = searchParams.get('date') || '';
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
  });

  const { data: operations = [] } = useQuery({
    queryKey: ['operations', partId],
    queryFn: () => masterDataService.getOperationsByPart(partId),
    enabled: !!partId,
  });

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', partId, opId],
    queryFn: () => masterDataService.getParameters(partId, opId),
    enabled: !!partId && !!opId,
  });

  const { data: dailyReportTransactions = [], isLoading } = useQuery({
    queryKey: ['daily-report', partId, opId, mcNo, dateParam],
    queryFn: () => inspectionService.getDailyReport({
      partId,
      operationId: opId,
      mcNo: mcNo || undefined,
      date: dateParam || undefined,
    }),
    enabled: !!partId && !!opId,
  });

  const currentPartInfo = parts.find((p: any) => p.id === partId);
  const currentOpInfo = operations.find((o: any) => o.id === opId);

  const handleDownloadPdf = async () => {
    if (!partId || !opId) return;
    setIsDownloadingPdf(true);
    try {
      const partStr = currentPartInfo?.partNumber || 'Part';
      await inspectionService.downloadDailyPdf(
        {
          partId,
          operationId: opId,
          mcNo: mcNo || undefined,
          date: dateParam || undefined,
        },
        `Inspector_Inprocess_Check_Sheet_${partStr}_${dateParam || 'report'}.pdf`
      );
      notifications.show({
        title: 'PDF Downloaded',
        message: 'Daily Check Sheet PDF generated via Puppeteer vector engine.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({
        title: 'Download Error',
        message: 'Failed to generate Puppeteer PDF report.',
        color: 'red',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getTxMetadata = (shiftName: string, intervalName: string) => {
    return dailyReportTransactions.find((t: any) => 
      t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && 
      t.intervalName === intervalName
    );
  };

  const getFooterStatus = (shiftName: string, intervalName: string) => {
    const tx = getTxMetadata(shiftName, intervalName);
    if (!tx) return '-';
    return (
      <Badge color={tx.status === 'PASSED' ? 'green' : 'red'} variant="filled" size="xs">
        {tx.status === 'PASSED' ? 'OK' : 'NG'}
      </Badge>
    );
  };

  const getInspectorSignature = (shiftName: string, intervalName: string) => {
    const tx = getTxMetadata(shiftName, intervalName);
    if (!tx?.inspector?.signature) return null;
    return (
      <img src={tx.inspector.signature} alt="Sig" style={{ height: 32, maxWidth: '100%', objectFit: 'contain', display: 'inline-block', mixBlendMode: 'multiply', verticalAlign: 'middle' }} />
    );
  };

  const getFooterInspector = (shiftName: string, intervalName: string) => {
    const tx = getTxMetadata(shiftName, intervalName);
    return tx?.inspector?.name || '-';
  };

  const getApproverSignature = (shiftName: string) => {
    const shiftTxs = dailyReportTransactions.filter(
      (t: any) => t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && t.approvedBy?.signature
    );
    if (shiftTxs.length === 0) return <Text size="xs" c="dimmed" fs="italic">Pending</Text>;
    const approver = shiftTxs[0].approvedBy;
    return (
      <div style={{ textAlign: 'center' }}>
        <img src={approver!.signature!} alt="Sig" style={{ height: 32, maxWidth: '100%', objectFit: 'contain', display: 'inline-block', mixBlendMode: 'multiply', verticalAlign: 'middle' }} />
      </div>
    );
  };

  const getRemarksText = () => {
    const activeRemarks = dailyReportTransactions
      .filter((t: any) => t.remarks)
      .map((t: any) => `${t.shift?.name || 'Shift'}: ${t.remarks}`);
    return activeRemarks.length > 0 ? activeRemarks.join(' | ') : 'No remarks logged today.';
  };

  const getReadingCount = (freq: string | undefined) => {
    if (!freq) return 1;
    const lowerFreq = freq.toLowerCase().trim();
    if (lowerFreq.includes('4nos') || lowerFreq.startsWith('4')) {
      return 2;
    }
    return 1;
  };

  const getCellContent = (shiftName: string, intervalName: string, param: any) => {
    const tx = dailyReportTransactions.find((t: any) => 
      t.shift?.name?.toLowerCase() === shiftName.toLowerCase() && 
      t.intervalName === intervalName
    );
    
    if (!tx || !tx.details) {
      if (getReadingCount(param.freqOfInspn) === 2) {
        return (
          <div className="relative h-11 w-full">
            <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="100" x2="100" y2="0" stroke="#000" strokeWidth="1" />
            </svg>
          </div>
        );
      }
      return null;
    }

    const readings = tx.details.filter((d: any) => d.parameterId === param.id);
    if (readings.length === 0) {
      if (getReadingCount(param.freqOfInspn) === 2) {
        return (
          <div className="relative h-11 w-full">
            <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
              <line x1="0" y1="100" x2="100" y2="0" stroke="#000" strokeWidth="1" />
            </svg>
          </div>
        );
      }
      return null;
    }

    if (readings.length >= 2) {
      return (
        <div className="relative h-11 w-full">
          <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            <line x1="0" y1="100" x2="100" y2="0" stroke="#000000" strokeWidth="1.2" />
          </svg>
          <span className={`absolute top-0.5 left-1 text-[9.5px] leading-none ${readings[0].status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
            {readings[0].observedValue}
          </span>
          <span className={`absolute bottom-0.5 right-1 text-[9.5px] leading-none ${readings[1].status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
            {readings[1].observedValue}
          </span>
        </div>
      );
    }

    const singleReading = readings[0];
    return (
      <div className={`flex items-center justify-center h-11 w-full text-center text-xs font-semibold ${singleReading.status === 'FAIL' ? 'text-red-600' : 'text-gray-800'}`}>
        {singleReading.observedValue}
      </div>
    );
  };

  const isOncePerDay = (param: any) => {
    return param.frequencyUnit === 'Day-wise' || param.frequencyUnit === 'day';
  };

  const isOncePerShift = (param: any) => {
    const freq = String(param.freqOfInspn || '').toLowerCase().trim();
    return freq === '1' || freq === 'once per shift' || freq === '1no/shift' || freq === '1/shift' || freq === '1/day';
  };

  const getMergedCellContentDay = (param: any) => {
    const allTransactions = [...dailyReportTransactions].sort(
      (a: any, b: any) => new Date(a.inspectionTimestamp).getTime() - new Date(b.inspectionTimestamp).getTime()
    );
    const readings: any[] = [];
    allTransactions.forEach((tx: any) => {
      if (tx.details) {
        tx.details.forEach((d: any) => {
          if (d.parameterId === param.id) readings.push(d);
        });
      }
    });

    return (
      <Table.Td p={0} colSpan={6} className="text-center h-11 align-middle">
        {readings[readings.length - 1] && (
          <span className={`text-xs ${readings[readings.length - 1].status === 'FAIL' ? 'text-red-600 font-bold' : 'text-gray-800 font-semibold'}`}>
            {readings[readings.length - 1].observedValue || ''}
          </span>
        )}
      </Table.Td>
    );
  };

  const getMergedCellContent = (shiftName: string, param: any) => {
    const shiftTransactions = dailyReportTransactions
      .filter((t: any) => t.shift?.name?.toLowerCase() === shiftName.toLowerCase())
      .sort((a: any, b: any) => new Date(a.inspectionTimestamp).getTime() - new Date(b.inspectionTimestamp).getTime());

    if (shiftTransactions.length === 0) return null;
    const readings: any[] = [];
    shiftTransactions.forEach((tx: any) => {
      if (tx.details) {
        tx.details.forEach((d: any) => {
          if (d.parameterId === param.id) readings.push(d);
        });
      }
    });

    if (readings.length === 0) return null;
    const r = readings[readings.length - 1];
    return (
      <div className={`flex items-center justify-center h-11 w-full text-center text-xs font-semibold ${r.status === 'FAIL' ? 'text-red-600' : 'text-gray-800'}`}>
        {r.observedValue}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="xl" />
      </Center>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6 text-black">
      {/* Top Action Bar */}
      <div className="max-w-[1350px] mx-auto mb-4">
        <Paper p="md" radius="md" withBorder className="bg-white shadow-sm">
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Button leftSection={<ArrowLeft size={16} />} variant="subtle" color="gray" onClick={() => navigate('/reports')}>
                Back to Reports
              </Button>
              <Text fw={800} size="lg" className="text-gray-900">
                Daily Audit Check Sheet — Full Window Preview
              </Text>
            </Group>
            <Button
              leftSection={<Download size={16} />}
              color="indigo"
              loading={isDownloadingPdf}
              onClick={handleDownloadPdf}
            >
              Download PDF Report
            </Button>
          </Group>
        </Paper>
      </div>

      {/* Main Check Sheet Card */}
      <div className="max-w-[1350px] mx-auto bg-white p-6 rounded-xl shadow-lg border border-gray-300 overflow-x-auto">
        {/* Header Box (Connected Border with Table Below) */}
        <div className="report-header-box flex items-stretch text-sm font-medium bg-white text-black" style={{ border: '1px solid #000', borderBottom: 'none' }}>
          {/* Left section: Logo + Company info */}
          <div className="w-[34.5%] flex flex-col justify-between" style={{ borderRight: '1px solid #000' }}>
            <div className="p-2.5 flex items-center gap-2">
              <div className="h-11 w-12 flex items-center justify-center shrink-0">
                <img 
                  src={settings.report_logo || "/tvs_logo.jpeg"} 
                  alt="Report Logo" 
                  className="max-h-11 max-w-full object-contain" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-extrabold text-[13px] text-[#000080] uppercase tracking-tight truncate">
                  {settings.report_company_name !== undefined ? settings.report_company_name : "SUNDRAM FASTENERS LTD.,"}
                </div>
                {(settings.report_company_subtitle || (!settings.report_company_name && settings.report_company_subtitle !== "")) && (
                  <div className="text-[9.5px] text-[#000080] font-semibold leading-tight mt-0.5 whitespace-pre-line">
                    {settings.report_company_subtitle ?? "AUTOLEC DIVISION, PLANT - II\nGUMMIDIPOONDI - 601201"}
                  </div>
                )}
              </div>
            </div>
            <div className="px-2.5 py-1.5 text-xs flex justify-between" style={{ borderTop: '1px solid #000' }}>
              <div>Date : <span className="font-bold pl-1">{dateParam || 'N/A'}</span></div>
              <div>M/c No. : <span className="font-bold pl-1">{mcNo || dailyReportTransactions[0]?.mcNo || 'N/A'}</span></div>
            </div>
          </div>
          
          {/* Middle section: Check sheet title */}
          <div className="w-[36.5%] p-2 flex flex-col justify-center items-center text-center" style={{ borderRight: '1px solid #000' }}>
            <Text size="md" fw={900} className="text-black uppercase font-black tracking-wider leading-tight">
              {settings.inspection_report_title || 'INSPECTOR - INPROCESS CHECK SHEET'}
            </Text>
          </div>

          {/* Right section: Boxed Grid Table for Part No, Part Name, Operation No. */}
          <div className="w-[29.0%] p-0 flex flex-col justify-center text-xs bg-white text-black">
            <table className="w-full h-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td className="font-bold w-[42%] p-1.5 bg-gray-50 text-[10px]" style={{ borderRight: '1px solid #000' }}>PART NO.</td>
                  <td className="font-bold p-1.5 text-xs">{currentPartInfo?.partNumber || 'N/A'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #000' }}>
                  <td className="font-bold p-1.5 bg-gray-50 text-[10px]" style={{ borderRight: '1px solid #000' }}>PART NAME</td>
                  <td className="font-bold p-1.5 text-[11px] truncate">{currentPartInfo?.partName || 'N/A'}</td>
                </tr>
                <tr>
                  <td className="font-bold p-1.5 bg-gray-50 text-[10px]" style={{ borderRight: '1px solid #000' }}>OPERATION NO.</td>
                  <td className="font-bold p-1.5 text-xs">{currentOpInfo?.operationNumber || 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Table Grid (Connected Border to Header Box Above) */}
        <Table withTableBorder withColumnBorders borderColor="#000" verticalSpacing="xs" horizontalSpacing="xs" style={{ borderCollapse: 'collapse' }} className="dark:text-gray-200">
          <Table.Thead className="bg-gray-50 text-center font-bold text-xs">
            <Table.Tr>
              <Table.Th rowSpan={2} style={{ width: 45 }} className="text-center">S. No.</Table.Th>
              <Table.Th rowSpan={2} className="text-center">Description</Table.Th>
              <Table.Th rowSpan={2} className="text-center">MISP NO/SC</Table.Th>
              <Table.Th rowSpan={2} style={{ width: 170 }} className="text-center">Specification (Standard)</Table.Th>
              <Table.Th rowSpan={2} style={{ width: 120 }} className="text-center">Method of checking</Table.Th>
              <Table.Th rowSpan={2} style={{ width: 90 }} className="text-center">Freq. of Inspn.</Table.Th>
              <Table.Th colSpan={2} className="text-center bg-blue-50 text-black">1st Shift (Shift A)</Table.Th>
              <Table.Th colSpan={2} className="text-center bg-teal-50 text-black">2nd Shift (Shift B)</Table.Th>
              <Table.Th colSpan={2} className="text-center bg-orange-50 text-black">3rd Shift (Shift C)</Table.Th>
            </Table.Tr>
            <Table.Tr>
              <Table.Th style={{ width: 85 }} className="text-center bg-blue-50/50">1 Half</Table.Th>
              <Table.Th style={{ width: 85 }} className="text-center bg-blue-50/50">2 Half</Table.Th>
              <Table.Th style={{ width: 85 }} className="text-center bg-teal-50/50">1 Half</Table.Th>
              <Table.Th style={{ width: 85 }} className="text-center bg-teal-50/50">2 Half</Table.Th>
              <Table.Th style={{ width: 85 }} className="text-center bg-orange-50/50">1 Half</Table.Th>
              <Table.Th style={{ width: 85 }} className="text-center bg-orange-50/50">2 Half</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody className="text-xs">
            {parameters.map((param: any, index: number) => {
              return (
                <Table.Tr key={param.id} className="hover:bg-gray-50/30">
                  <Table.Td className="text-center font-semibold">{String(index + 1).padStart(2, '0')}</Table.Td>
                  <Table.Td className="font-semibold">{param.parameterName}</Table.Td>
                  <Table.Td className="font-semibold">{param.class}</Table.Td>
                  <Table.Td className="text-center font-medium">{param.specText || `${param.nominalValue} ±${param.upperTolerance}`}</Table.Td>
                  <Table.Td className="text-center">{param.methodOfChecking || '-'}</Table.Td>
                  <Table.Td className="text-center font-medium">{param.freqOfInspn || '-'}</Table.Td>
                  {isOncePerDay(param) ? (
                    <>{getMergedCellContentDay(param)}</>
                  ) : isOncePerShift(param) ? (
                    <>
                      <Table.Td p={0} colSpan={2}>{getMergedCellContent('Shift A', param)}</Table.Td>
                      <Table.Td p={0} colSpan={2}>{getMergedCellContent('Shift B', param)}</Table.Td>
                      <Table.Td p={0} colSpan={2}>{getMergedCellContent('Shift C', param)}</Table.Td>
                    </>
                  ) : (
                    <>
                      <Table.Td p={0}>{getCellContent('Shift A', '1 Half', param)}</Table.Td>
                      <Table.Td p={0}>{getCellContent('Shift A', '2 Half', param)}</Table.Td>
                      <Table.Td p={0}>{getCellContent('Shift B', '1 Half', param)}</Table.Td>
                      <Table.Td p={0}>{getCellContent('Shift B', '2 Half', param)}</Table.Td>
                      <Table.Td p={0}>{getCellContent('Shift C', '1 Half', param)}</Table.Td>
                      <Table.Td p={0}>{getCellContent('Shift C', '2 Half', param)}</Table.Td>
                    </>
                  )}
                </Table.Tr>
              );
            })}
            
            <Table.Tr className="bg-gray-50 font-bold text-center">
              <Table.Td colSpan={3}>Abbreviations</Table.Td>
              <Table.Td colSpan={2}>Remarks</Table.Td>
              <Table.Td className="text-center text-[11px] whitespace-nowrap">Status</Table.Td>
              <Table.Td>{getFooterStatus('Shift A', '1 Half')}</Table.Td>
              <Table.Td>{getFooterStatus('Shift A', '2 Half')}</Table.Td>
              <Table.Td>{getFooterStatus('Shift B', '1 Half')}</Table.Td>
              <Table.Td>{getFooterStatus('Shift B', '2 Half')}</Table.Td>
              <Table.Td>{getFooterStatus('Shift C', '1 Half')}</Table.Td>
              <Table.Td>{getFooterStatus('Shift C', '2 Half')}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td className="text-center font-bold">NP</Table.Td>
              <Table.Td colSpan={2} className="font-medium">No Production</Table.Td>
              <Table.Td colSpan={2} rowSpan={3} className="align-top italic p-2 text-xs">
                {getRemarksText()}
              </Table.Td>
              <Table.Td className="text-center font-bold whitespace-nowrap text-[11px] p-1">Inspected by</Table.Td>
              <Table.Td className="text-center text-[10px]">
                {getInspectorSignature('Shift A', '1 Half') || getFooterInspector('Shift A', '1 Half')}
              </Table.Td>
              <Table.Td className="text-center text-[10px]">
                {getInspectorSignature('Shift A', '2 Half') || getFooterInspector('Shift A', '2 Half')}
              </Table.Td>
              <Table.Td className="text-center text-[10px]">
                {getInspectorSignature('Shift B', '1 Half') || getFooterInspector('Shift B', '1 Half')}
              </Table.Td>
              <Table.Td className="text-center text-[10px]">
                {getInspectorSignature('Shift B', '2 Half') || getFooterInspector('Shift B', '2 Half')}
              </Table.Td>
              <Table.Td className="text-center text-[10px]">
                {getInspectorSignature('Shift C', '1 Half') || getFooterInspector('Shift C', '1 Half')}
              </Table.Td>
              <Table.Td className="text-center text-[10px]">
                {getInspectorSignature('Shift C', '2 Half') || getFooterInspector('Shift C', '2 Half')}
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td className="text-center font-bold">SC</Table.Td>
              <Table.Td colSpan={2} className="font-medium">Significant Characteristic</Table.Td>
              <Table.Td className="text-center font-bold whitespace-nowrap text-[11px] p-1">Checked by</Table.Td>
              <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift A')}</Table.Td>
              <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift B')}</Table.Td>
              <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift C')}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td colSpan={3} className="text-center text-[9px] text-gray-500 font-medium">
                {settings.inspection_report_doc_number || 'TAF / P2 / 9.1B'} (Rev date: {settings.inspection_report_r_date || '06.10.2023'})
              </Table.Td>
              <Table.Td className="text-center font-bold whitespace-nowrap text-[11px] p-1">Approved by</Table.Td>
              <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift A')}</Table.Td>
              <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift B')}</Table.Td>
              <Table.Td colSpan={2} className="text-center text-[10px]">{getApproverSignature('Shift C')}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </div>
    </div>
  );
}
