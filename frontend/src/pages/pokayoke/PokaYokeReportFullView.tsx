import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Group, Text, Paper, Table, Loader, Center } from '@mantine/core';
import { ArrowLeft, Download, Check, X } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import api from '../../lib/axios';
import { masterDataService } from '../../services/master-data.service';
import { settingsService } from '../../services/settings.service';

export function PokaYokeReportFullView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const partId = searchParams.get('partId') || '';
  const startDateStr = searchParams.get('startDate') || '';
  const endDateStr = searchParams.get('endDate') || startDateStr;
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const { data: settings = {} } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsService.getAll,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
  });

  const tpl = {
    companyName: settings.report_company_name !== undefined ? settings.report_company_name : '',
    companySubtitle: settings.report_company_subtitle !== undefined ? settings.report_company_subtitle : '',
    title: settings.pokayoke_report_title || settings.report_title || 'POKA-YOKE INSPECTION REPORT',
    rNo: settings.pokayoke_report_r_no || settings.report_r_no || '03',
    rDate: settings.pokayoke_report_r_date || settings.report_r_date || '23.04.2023',
    docNumber: settings.pokayoke_report_doc_number || settings.report_doc_number || 'TAF/P2/9.4',
    logo: settings.report_logo || null,
  };

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['pokayoke-report-full', partId, startDateStr, endDateStr],
    queryFn: async () => {
      if (!partId || !startDateStr) return null;
      const { data } = await api.get('/pokayoke/report', {
        params: {
          partId,
          startDate: new Date(startDateStr).toISOString(),
          endDate: new Date(endDateStr).toISOString(),
        }
      });
      return data;
    },
    enabled: !!partId && !!startDateStr,
  });

  const handleDownloadPdf = async () => {
    if (!partId || !startDateStr) return;
    setIsDownloadingPdf(true);
    try {
      const response = await api.get('/pokayoke/report/pdf', {
        params: { partId, startDate: startDateStr, endDate: endDateStr },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PokaYoke_Report_${startDateStr}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notifications.show({ title: 'Success', message: 'Poka Yoke Report PDF generated via Puppeteer vector engine.', color: 'green' });
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to generate Puppeteer PDF report.', color: 'red' });
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const getDateColumns = () => {
    if (!startDateStr) return [];
    const cols = [];
    let current = new Date(startDateStr);
    current.setHours(0, 0, 0, 0);
    const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
    end.setHours(23, 59, 59, 999);
    
    while (current <= end) {
      cols.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return cols;
  };

  const dateColumns = getDateColumns();

  const getReading = (itemId: string, date: Date) => {
    if (!reportData?.transactions) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;
    
    for (let i = reportData.transactions.length - 1; i >= 0; i--) {
      const txn = reportData.transactions[i];
      const txnDate = new Date(txn.date);
      const txnY = txnDate.getFullYear();
      const txnM = String(txnDate.getMonth() + 1).padStart(2, '0');
      const txnD = String(txnDate.getDate()).padStart(2, '0');
      if (`${txnY}-${txnM}-${txnD}` === targetDateStr) {
        const itemDetails = txn.details.filter((d: any) => d.pokaYokeItemId === itemId);
        if (itemDetails.length > 0) {
          const passDetail = itemDetails.find((d: any) => d.status === 'PASS');
          return passDetail || itemDetails[0];
        }
      }
    }
    return null;
  };

  const getTransactionForDate = (date: Date) => {
    if (!reportData?.transactions) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const targetDateStr = `${y}-${m}-${d}`;

    for (let i = reportData.transactions.length - 1; i >= 0; i--) {
      const txn = reportData.transactions[i];
      const txnDate = new Date(txn.date);
      const txnY = txnDate.getFullYear();
      const txnM = String(txnDate.getMonth() + 1).padStart(2, '0');
      const txnD = String(txnDate.getDate()).padStart(2, '0');
      if (`${txnY}-${txnM}-${txnD}` === targetDateStr) {
        return txn;
      }
    }
    return null;
  };

  const currentPartInfo = parts.find((p: any) => p.id === partId);

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
      <div className="max-w-[1450px] mx-auto mb-4">
        <Paper p="md" radius="md" withBorder className="bg-white shadow-sm">
          <Group justify="space-between" align="center">
            <Group gap="sm">
              <Button leftSection={<ArrowLeft size={16} />} variant="subtle" color="gray" onClick={() => navigate('/pokayoke/reports')}>
                Back to Poka Yoke Reports
              </Button>
              <Text fw={800} size="lg" className="text-gray-900">
                Poka Yoke Daily Audit Check Sheet — Full Window Preview
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

      {/* Main Report Card */}
      <div className="max-w-[1450px] mx-auto bg-white p-6 rounded-xl shadow-lg border border-gray-300 overflow-x-auto">
        <Table striped highlightOnHover withTableBorder withColumnBorders style={{ borderCollapse: 'collapse' }}>
          <Table.Thead className="bg-white dark:bg-[#1f2025]">
            <Table.Tr>
              <Table.Th 
                colSpan={1} 
                style={{ backgroundColor: '#204080', color: 'white', textAlign: 'center', padding: '8px 10px', verticalAlign: 'middle', width: 140 }}
              >
                {tpl.logo ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50, maxHeight: 60, width: '100%' }}>
                    <img 
                      src={tpl.logo} 
                      alt="Report Logo" 
                      style={{ maxHeight: '52px', maxWidth: '120px', objectFit: 'contain' }} 
                    />
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', border: '2px solid white', borderRadius: '50%', width: 50, height: 50, alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                    <Text fw={900} size="lg" style={{ fontStyle: 'italic', letterSpacing: '-1px' }}>TVS</Text>
                  </div>
                )}
              </Table.Th>
              <Table.Th colSpan={4 + dateColumns.length} style={{ padding: '12px' }}>
                {tpl.companyName && <Text fw={800} size="sm">{tpl.companyName}</Text>}
                {tpl.companySubtitle && <Text fw={600} size="xs" c="dimmed" mt={2}>{tpl.companySubtitle}</Text>}
                <Text fw={700} size="sm" mt={4}>{tpl.title}</Text>
                <Text fw={700} size="sm" mt={4} style={{ textTransform: 'uppercase' }}>
                  PART NUMBER : {currentPartInfo?.partNumber || ''} {currentPartInfo?.partName || ''}
                </Text>
              </Table.Th>
            </Table.Tr>
            <Table.Tr>
              <Table.Th rowSpan={2} style={{ width: 45 }} className="text-center">SI.No</Table.Th>
              <Table.Th rowSpan={2}>Operation</Table.Th>
              <Table.Th rowSpan={2}>POKA-YOKE</Table.Th>
              <Table.Th rowSpan={2}>Checking Method</Table.Th>
              <Table.Th rowSpan={2}>Frequency</Table.Th>
              <Table.Th colSpan={dateColumns.length} style={{ textAlign: 'center' }}>Date</Table.Th>
            </Table.Tr>
            <Table.Tr>
              {dateColumns.map((d, i) => (
                <Table.Th key={i} style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '4px 6px', fontSize: '11px' }}>
                  {String(d.getDate()).padStart(2, '0')}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {reportData?.items?.map((item: any, idx: number) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500} style={{ padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}>{idx + 1}</Table.Td>
                <Table.Td style={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 140, padding: '4px 6px', fontSize: '11px' }}>{item.operation}</Table.Td>
                <Table.Td style={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 160, padding: '4px 6px', fontSize: '11px', fontWeight: 600 }}>{item.pokaYokeName}</Table.Td>
                <Table.Td style={{ wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: 140, padding: '4px 6px', fontSize: '11px' }}>{item.checkingMethod || '-'}</Table.Td>
                <Table.Td style={{ padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}>
                  <Text size="xs">{item.frequency || 'N/A'}</Text>
                </Table.Td>
                {dateColumns.map((d, i) => {
                  const reading = getReading(item.id, d);
                  return (
                    <Table.Td key={i} style={{ textAlign: 'center', padding: '4px 6px' }}>
                      {reading ? (
                        <Group gap={4} justify="center" wrap="nowrap">
                          {reading.status === 'PASS' ? (
                            <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto">
                              <Check size={14} />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto">
                              <X size={14} />
                            </div>
                          )}
                        </Group>
                      ) : (
                        <Text c="dimmed">-</Text>
                      )}
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
            {/* Overall Status Section */}
            <Table.Tr>
              <Table.Td colSpan={5} fw={700} ta="right" pr="xl">Overall Status (OK / NOT OK)</Table.Td>
              {dateColumns.map((d, i) => {
                const txn = getTransactionForDate(d);
                return (
                  <Table.Td key={i} style={{ textAlign: 'center' }}>
                    {txn ? (
                      <Text fw={700} size="sm" c={txn.status === 'PASSED' || txn.status === 'APPROVED' ? 'green' : 'red'}>
                        {txn.status === 'PASSED' || txn.status === 'APPROVED' ? 'OK' : 'NOT OK'}
                      </Text>
                    ) : (
                      <Text c="dimmed">-</Text>
                    )}
                  </Table.Td>
                );
              })}
            </Table.Tr>

            {/* Signature Section */}
            <Table.Tr>
              <Table.Td colSpan={3} fw={700} style={{ borderBottom: 'none', paddingBottom: 4 }}>R.No : {tpl.rNo}</Table.Td>
              <Table.Td colSpan={2} fw={700}>INSPECTED BY</Table.Td>
              {dateColumns.map((d, i) => {
                const txn = getTransactionForDate(d);
                return (
                  <Table.Td key={i} style={{ textAlign: 'center' }}>
                     {txn?.inspector?.signature ? (
                       <img src={txn.inspector.signature} alt={txn.inspector.name} className="h-8 object-contain mx-auto" />
                     ) : txn?.inspector?.name ? (
                       <Text size="sm" fw={500}>{txn.inspector.name}</Text>
                     ) : (
                       <Text c="dimmed">-</Text>
                     )}
                  </Table.Td>
                );
              })}
            </Table.Tr>
            <Table.Tr>
              <Table.Td colSpan={3} fw={700} style={{ borderTop: 'none', paddingTop: 0 }}>R.Date : {tpl.rDate}</Table.Td>
              <Table.Td colSpan={2} fw={700}>APPROVED BY</Table.Td>
              {dateColumns.map((d, i) => {
                const txn = getTransactionForDate(d);
                return (
                  <Table.Td key={i} style={{ textAlign: 'center' }}>
                     {txn?.adminUser?.signature ? (
                       <img src={txn.adminUser.signature} alt={txn.adminUser.name} className="h-8 object-contain mx-auto" />
                     ) : txn?.adminUser?.name ? (
                       <Text size="sm" c="green" fw={500}>{txn.adminUser.name}</Text>
                     ) : (
                       <Text c="dimmed">-</Text>
                     )}
                  </Table.Td>
                );
              })}
            </Table.Tr>
          </Table.Tbody>
        </Table>
        <Text size="xs" fw={600} mt="xs" mb="xs">{tpl.docNumber}</Text>
      </div>
    </div>
  );
}
