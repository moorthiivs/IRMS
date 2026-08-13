import { useState, useMemo } from 'react';
import { Title, Paper, Table, Group, Text, Badge, Select, Modal, ActionIcon, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Trash2, CheckCircle2, XCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { spcService } from '../../services/spc.service';
import { masterDataService } from '../../services/master-data.service';
import { TableSkeleton } from '../../components/TableSkeleton';

export function SpcIndividualReport() {
  const [reportDate, setReportDate] = useState<string | null>(new Date().toISOString().split('T')[0]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  // Query saved reports for selected Date & Customer to derive valid Part and Machine dropdowns
  const { data: customerReports = [] } = useQuery({
    queryKey: ['spc-reports-customer-filter', reportDate, selectedCustomer],
    queryFn: () => spcService.getRecent({
      date: reportDate || undefined,
      customerId: selectedCustomer || undefined,
    }),
  });

  const availablePartsForCustomer = useMemo(() => {
    const map = new Map();
    customerReports.forEach((r: any) => {
      if (r.part) {
        map.set(r.part.id, r.part);
      }
    });
    return Array.from(map.values());
  }, [customerReports]);

  const availableMachinesForCustomer = useMemo(() => {
    const machines = new Set<string>();

    if (selectedCustomer) {
      const customerObj = customers.find((c: any) => c.id === selectedCustomer);
      if (customerObj?.activeMachines && customerObj.activeMachines.length > 0) {
        customerObj.activeMachines.forEach((m: string) => { if (m && m !== 'N/A') machines.add(m); });
      }
      if (customerObj?.machines && customerObj.machines.length > 0) {
        customerObj.machines.forEach((m: string) => { if (m && m !== 'N/A') machines.add(m); });
      }
    } else {
      customers.forEach((c: any) => {
        if (c.activeMachines) c.activeMachines.forEach((m: string) => { if (m && m !== 'N/A') machines.add(m); });
        if (c.machines) c.machines.forEach((m: string) => { if (m && m !== 'N/A') machines.add(m); });
      });
    }

    customerReports.forEach((r: any) => {
      if (r.mcNo && r.mcNo !== 'N/A') machines.add(r.mcNo);
    });

    return Array.from(machines);
  }, [customers, customerReports, selectedCustomer]);

  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['spc-reports', reportDate, selectedCustomer, selectedPart, selectedMachine, statusFilter],
    queryFn: () => spcService.getRecent({
      date: reportDate || undefined,
      customerId: selectedCustomer || undefined,
      partId: selectedPart || undefined,
      machineNumber: selectedMachine || undefined,
      status: statusFilter || undefined,
    }),
  });



  const toggleReportExpand = (id: string) => {
    setExpandedReports(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this SPC entry report?')) {
      await spcService.deleteSpc(id);
      refetch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Title order={2}>SPC Individual Reports</Title>
          <Text size="sm" c="dimmed">View individual Statistical Process Control measurement entries and parameter statuses</Text>
        </div>
      </div>

      <Paper p="md" radius="md" withBorder className="shadow-sm">
        <Group gap="md">
          <TextInput
            type="date"
            label="Report Date"
            value={reportDate || ''}
            onChange={(e) => setReportDate(e.target.value || null)}
            className="w-44"
          />
          <Select
            label="Filter Customer"
            placeholder="All Customers"
            data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
            value={selectedCustomer}
            onChange={(val) => {
              setSelectedCustomer(val);
              setSelectedPart(null);
              setSelectedMachine(null);
            }}
            clearable
            searchable
            className="w-48"
          />
          <Select
            label="Filter Part"
            placeholder="All Parts"
            data={availablePartsForCustomer.map((p: any) => ({ value: p.id, label: p.partNumber }))}
            value={selectedPart}
            onChange={(val) => {
              setSelectedPart(val);
            }}
            disabled={!selectedCustomer}
            clearable
            searchable
            className="w-44"
          />
          <Select
            label="Filter Machine"
            placeholder="All Machines"
            data={availableMachinesForCustomer.map((m: any) => ({ value: m, label: m }))}
            value={selectedMachine}
            onChange={setSelectedMachine}
            disabled={!selectedCustomer}
            clearable
            searchable
            className="w-44"
          />
          <Select
            label="Filter Status"
            placeholder="All Statuses"
            data={[
              { value: 'PASSED', label: 'Passed' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            clearable
            className="w-40"
          />
        </Group>
      </Paper>

      {isLoading ? (
        <Paper shadow="sm" radius="md" withBorder p="md"><TableSkeleton rows={5} /></Paper>
      ) : reports.length === 0 ? (
        <Paper shadow="sm" radius="md" withBorder p="xl" className="text-center">
          <Text c="dimmed">No SPC entry reports found matching criteria.</Text>
        </Paper>
      ) : (
        <Paper shadow="sm" radius="md" withBorder className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table verticalSpacing="sm" striped highlightOnHover style={{ minWidth: 950 }}>
              <Table.Thead className="bg-gray-50 dark:bg-[#25262b]">
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}></Table.Th>
                  <Table.Th>Datetime</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Part Number</Table.Th>
                  <Table.Th>Total Parameters</Table.Th>
                  <Table.Th>Overall Status</Table.Th>
                  <Table.Th style={{ width: 80 }}>Action</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {reports.map((r: any) => {
                  const isExpanded = expandedReports[r.id] ?? true;
                  const timestampStr = r.inspectionTimestamp ? format(new Date(r.inspectionTimestamp), 'dd-MM-yyyy hh:mma') : 'N/A';
                  const custName = r.customer?.name || r.customerName || 'Test Customer';
                  const partNo = r.part?.partNumber || r.partId || 'N/A';
                  const detailsList = r.details && r.details.length > 0 ? r.details : [r];
                  const totalParams = detailsList.length;

                  const isOverallPassed = detailsList.every((d: any) => {
                    const st = d.status || r.status;
                    return st === 'PASS' || st === 'PASSED';
                  });

                  return (
                    <>
                      {/* Summary Row */}
                      <Table.Tr key={r.id} className="bg-blue-50/30 dark:bg-blue-950/20 font-medium">
                        <Table.Td>
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            size="sm"
                            onClick={() => toggleReportExpand(r.id)}
                          >
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </ActionIcon>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={600} size="sm">{timestampStr}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500} size="sm">{custName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="blue" size="md">{partNo}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" color="indigo" size="sm">
                            {totalParams} Parameter{totalParams !== 1 ? 's' : ''}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          {isOverallPassed ? (
                            <Badge color="green" leftSection={<CheckCircle2 size={12} />}>PASSED</Badge>
                          ) : (
                            <Badge color="red" leftSection={<XCircle size={12} />}>REJECTED</Badge>
                          )}
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon color="red" variant="light" size="sm" onClick={() => handleDelete(r.id)}>
                            <Trash2 size={14} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>

                      {/* Expanded Sub-table */}
                      {isExpanded && (
                        <Table.Tr key={`${r.id}_expanded`}>
                          <Table.Td colSpan={7} style={{ padding: 0 }}>
                            <div className="p-3 bg-gray-50/70 dark:bg-[#1a1b1e] border-y border-gray-200 dark:border-gray-700">
                              <Table verticalSpacing="xs" striped highlightOnHover className="bg-white dark:bg-gray-800 rounded-md overflow-hidden shadow-inner">
                                <Table.Thead className="bg-gray-100 dark:bg-gray-900 text-xs">
                                  <Table.Tr>
                                    <Table.Th>Product Description</Table.Th>
                                    <Table.Th>Quality Characteristic</Table.Th>
                                    <Table.Th>USL</Table.Th>
                                    <Table.Th>LSL</Table.Th>
                                    <Table.Th>Mean ((USL+LSL)/2)</Table.Th>
                                    <Table.Th>Actual Reading</Table.Th>
                                    <Table.Th>Status</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {detailsList.map((d: any, idx: number) => {
                                    const prodDesc = d.productDescription || d.parameter?.productDescription || r.productDescription || '-';
                                    const paramName = d.parameter?.parameterName || d.qualityCharacteristic || r.parameterName || '-';
                                    const uslVal = d.usl ?? d.parameter?.usl ?? r.usl;
                                    const lslVal = d.lsl ?? d.parameter?.lsl ?? r.lsl;

                                    let meanVal = '-';
                                    if (uslVal !== null && uslVal !== undefined && lslVal !== null && lslVal !== undefined) {
                                      const u = parseFloat(uslVal);
                                      const l = parseFloat(lslVal);
                                      if (!isNaN(u) && !isNaN(l)) {
                                        meanVal = ((u + l) / 2).toFixed(4).replace(/\.?0+$/, '');
                                      }
                                    }

                                    const actualReading = d.observedValue || r.observedValue || r.sampleValues || '-';
                                    const isPass = d.status === 'PASS' || d.status === 'PASSED' || (r.status === 'PASSED' && d.status !== 'FAIL');

                                    return (
                                      <Table.Tr key={d.id || `${r.id}_${idx}`}>
                                        <Table.Td>
                                          <Text size="sm">{prodDesc}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                          <Text fw={600} size="sm" className="text-gray-900 dark:text-gray-100">
                                            {paramName}
                                          </Text>
                                        </Table.Td>
                                        <Table.Td>
                                          <Text size="sm" fw={600} c="green">{uslVal ?? '-'}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                          <Text size="sm" fw={600} c="red">{lslVal ?? '-'}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                          <Badge color="cyan" variant="light" size="xs">{meanVal}</Badge>
                                        </Table.Td>
                                        <Table.Td>
                                          <Text size="sm" fw={500}>{actualReading}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                          {isPass ? (
                                            <Badge color="green" size="xs">PASS</Badge>
                                          ) : (
                                            <Badge color="red" size="xs">FAIL</Badge>
                                          )}
                                        </Table.Td>
                                      </Table.Tr>
                                    );
                                  })}
                                </Table.Tbody>
                              </Table>
                            </div>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </>
                  );
                })}
              </Table.Tbody>
            </Table>
          </div>
        </Paper>
      )}

      {/* Details View Modal */}
      <Modal
        opened={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={`SPC Report Details - ${selectedReport?.part?.partNumber || ''}`}
        size="lg"
        centered
      >
        {selectedReport && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
              <div><strong>Part:</strong> {selectedReport.part?.partNumber} ({selectedReport.part?.partName})</div>
              <div><strong>Operation:</strong> {selectedReport.operation?.operationNumber}</div>
              <div><strong>Inspector:</strong> {selectedReport.inspector?.name}</div>
              <div><strong>Status:</strong> {selectedReport.status}</div>
              <div><strong>Shift:</strong> {selectedReport.shift?.name || '-'}</div>
              <div><strong>M/C No:</strong> {selectedReport.mcNo || '-'}</div>
              <div><strong>Lot No:</strong> {selectedReport.lotNumber || '-'}</div>
              <div><strong>Interval:</strong> {selectedReport.intervalName}</div>
            </div>

            <Title order={5}>Recorded Parameters</Title>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Parameter</Table.Th>
                  <Table.Th>Specification</Table.Th>
                  <Table.Th>Observed Value</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedReport.details?.map((d: any) => (
                  <Table.Tr key={d.id}>
                    <Table.Td>{d.parameter?.parameterName || d.parameterId}</Table.Td>
                    <Table.Td>{d.parameter?.specText || `${d.parameter?.nominalValue || '-'} (${d.parameter?.lowerTolerance || ''} / ${d.parameter?.upperTolerance || ''})`}</Table.Td>
                    <Table.Td className="font-semibold">{d.observedValue}</Table.Td>
                    <Table.Td>
                      {d.status === 'PASS' ? (
                        <Badge color="green" size="sm">PASS</Badge>
                      ) : (
                        <Badge color="red" size="sm">FAIL</Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Modal>
    </div>
  );
}
