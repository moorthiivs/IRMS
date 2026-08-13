import { useState, useMemo } from 'react';
import {
  Title, Paper, Tabs, Group, Button, Text, Table, Badge, Select, FileInput, 
  NumberInput, TextInput, SimpleGrid, ActionIcon, Modal, Tooltip, Skeleton, Checkbox
} from '@mantine/core';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Upload, FileSpreadsheet, Plus, Pencil, Trash2, CheckCircle2, Search, ChevronRight, ChevronDown } from 'lucide-react';
import { spcService } from '../../services/spc.service';
import { masterDataService } from '../../services/master-data.service';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

export function SpcMasterData() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string | null>('characteristics');

  // Filters & Grouping State
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Master Data Queries
  const { data: parts = [] } = useQuery({ queryKey: ['parts'], queryFn: masterDataService.getParts });
  const { data: customers = [] } = useQuery({ queryKey: ['customers'], queryFn: masterDataService.getCustomers });

  // Upload State
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [isNewPart, setIsNewPart] = useState(false);
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newPartName, setNewPartName] = useState('');

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // Edit / Add Modal State
  const [modalOpened, setModalOpened] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [productDescription, setProductDescription] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [machineNumber, setMachineNumber] = useState('');
  const [qualityCharacteristic, setQualityCharacteristic] = useState('');
  const [usl, setUsl] = useState<number | ''>('');
  const [lsl, setLsl] = useState<number | ''>('');
  const [frequency, setFrequency] = useState<string | null>('1/shift');
  const [customerId, setCustomerId] = useState<string | null>(null);

  // Group Management Modal States
  const [parameterManagerGroup, setParameterManagerGroup] = useState<any | null>(null);
  const [groupEditGroup, setGroupEditGroup] = useState<any | null>(null);
  const [groupEditCustomer, setGroupEditCustomer] = useState<string | null>(null);
  const [groupEditPartNumber, setGroupEditPartNumber] = useState('');

  // Queries
  const { data: characteristics = [], isLoading, refetch } = useQuery({
    queryKey: ['spc-characteristics'],
    queryFn: () => spcService.getCharacteristics(),
  });

  // Mutations
  const updateMutation = useMutation({
    mutationFn: () => spcService.updateCharacteristic(editingId!, {
      productDescription,
      partNumber,
      machineNumber,
      qualityCharacteristic,
      usl: usl !== '' ? Number(usl) : null,
      lsl: lsl !== '' ? Number(lsl) : null,
      frequency,
      customerId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spc-characteristics'] });
      notifications.show({ title: 'Updated', message: 'SPC Characteristic updated successfully.', color: 'green' });
      closeModal();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to update characteristic.', color: 'red' });
    },
  });

  const createMutation = useMutation({
    mutationFn: () => spcService.uploadCharacteristics([{
      productDescription,
      partNumber,
      machineNumber,
      qualityCharacteristic,
      usl: usl !== '' ? Number(usl) : undefined,
      lsl: lsl !== '' ? Number(lsl) : undefined,
      frequency: frequency || '1/shift',
      customerId,
    }]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spc-characteristics'] });
      notifications.show({ title: 'Created', message: 'SPC Characteristic created successfully.', color: 'green' });
      closeModal();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to create characteristic.', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: spcService.deleteCharacteristic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spc-characteristics'] });
      notifications.show({ title: 'Deleted', message: 'SPC Characteristic deleted successfully.', color: 'green' });
    },
  });

  const openCreateModal = () => {
    setEditingId(null);
    setProductDescription('');
    setPartNumber('');
    setMachineNumber('');
    setQualityCharacteristic('');
    setUsl('');
    setLsl('');
    setFrequency('1/shift');
    setCustomerId(null);
    setModalOpened(true);
  };

  const openCreateModalForGroup = (group: any) => {
    setEditingId(null);
    setProductDescription('');
    setPartNumber(group.partNumber || '');
    setMachineNumber('');
    setQualityCharacteristic('');
    setUsl('');
    setLsl('');
    setFrequency('1/shift');
    setCustomerId(group.customerId || null);
    setModalOpened(true);
  };

  const openEditModal = (item: any) => {
    setEditingId(item.id);
    setProductDescription(item.productDescription || '');
    setPartNumber(item.partNumber);
    setMachineNumber(item.machineNumber || '');
    setQualityCharacteristic(item.qualityCharacteristic);
    setUsl(item.usl !== null && item.usl !== undefined ? item.usl : '');
    setLsl(item.lsl !== null && item.lsl !== undefined ? item.lsl : '');
    setFrequency(item.frequency || '1/shift');
    setCustomerId(item.customerId || null);
    setModalOpened(true);
  };

  const closeModal = () => {
    setModalOpened(false);
    setEditingId(null);
    setProductDescription('');
    setPartNumber('');
    setMachineNumber('');
    setQualityCharacteristic('');
    setUsl('');
    setLsl('');
    setFrequency('1/shift');
    setCustomerId(null);
  };

  const confirmDeleteGroup = (group: any) => {
    modals.openConfirmModal({
      title: 'Delete Entire Part Data',
      children: (
        <Text size="sm">
          Are you sure you want to delete ALL <strong>{group.items.length} parameter(s)</strong> for Part Number <strong>{group.partNumber}</strong> ({group.customerName})? This action cannot be undone.
        </Text>
      ),
      labels: { confirm: 'Delete Entire Data', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await Promise.all(group.items.map((item: any) => spcService.deleteCharacteristic(item.id)));
          refetch();
          notifications.show({
            title: 'Deleted',
            message: `Successfully deleted all parameters for Part ${group.partNumber}!`,
            color: 'green',
          });
        } catch (err) {
          notifications.show({ title: 'Error', message: 'Failed to delete group data.', color: 'red' });
        }
      },
    });
  };

  const handleGroupEditSave = async () => {
    if (!groupEditGroup) return;
    try {
      await Promise.all(
        groupEditGroup.items.map((item: any) =>
          spcService.updateCharacteristic(item.id, {
            partNumber: groupEditPartNumber || item.partNumber,
            customerId: groupEditCustomer || item.customerId,
          })
        )
      );
      setGroupEditGroup(null);
      refetch();
      notifications.show({
        title: 'Group Updated',
        message: 'Successfully updated Part Number and Customer for group.',
        color: 'green',
      });
    } catch (err) {
      notifications.show({ title: 'Error', message: 'Failed to update group.', color: 'red' });
    }
  };

  const confirmDelete = (item: any) => {
    modals.openConfirmModal({
      title: 'Delete SPC Characteristic',
      children: (
        <Text size="sm">
          Are you sure you want to delete <strong>{item.qualityCharacteristic}</strong> for Part Number <strong>{item.partNumber}</strong>?
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => deleteMutation.mutate(item.id),
    });
  };

  // Excel File Upload Parser matching user's exact format
  const handleFileChange = (file: File | null) => {
    setUploadFile(file);
    if (!file) {
      setParsedRecords([]);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Map column names according to user's Excel format:
        // Customer | Product Description | Quality Characteristic | Specification USL | Specification LSL | Frequency
        const records = json.map((row: any) => {
          const customerName = String(row['Customer'] || row['CustomerName'] || '').trim();
          const productDescription = String(row['Product Description'] || row['ProductDescription'] || row['Description'] || '').trim();
          
          const pNumber = isNewPart ? newPartNumber : (selectedPart ? parts.find((p:any) => p.id === selectedPart)?.partNumber : '');
          const pName = isNewPart ? newPartName : (productDescription || '');

          const qualityCharacteristic = String(row['Quality Characteristic'] || row['QualityCharacteristic'] || row['Characteristic'] || row['Parameter'] || '').trim();
          const uslVal = row['USL'] !== undefined ? parseFloat(row['USL']) : (row['Specification USL'] !== undefined ? parseFloat(row['Specification USL']) : undefined);
          const lslVal = row['LSL'] !== undefined ? parseFloat(row['LSL']) : (row['Specification LSL'] !== undefined ? parseFloat(row['Specification LSL']) : undefined);
          const frequency = String(row['Frequency'] || row['freq'] || row['FrequencyOption'] || '1/shift').trim();

          return {
            customerName: customerName || undefined,
            productDescription: pName || undefined,
            partNumber: pNumber,
            qualityCharacteristic,
            usl: isNaN(uslVal!) ? undefined : uslVal,
            lsl: isNaN(lslVal!) ? undefined : lslVal,
            frequency: frequency || '1/shift',
          };
        }).filter(r => !!r.partNumber && !!r.qualityCharacteristic);

        setParsedRecords(records);
        notifications.show({
          title: 'File Parsed Successfully',
          message: `Found ${records.length} valid SPC Quality Characteristic records from Excel file.`,
          color: 'blue',
        });
      } catch (err) {
        notifications.show({
          title: 'Excel Read Error',
          message: 'Could not parse Excel file. Please check column format.',
          color: 'red',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBatchUpload = async () => {
    if (parsedRecords.length === 0) return;
    setUploading(true);
    try {
      await spcService.uploadCharacteristics(parsedRecords);
      notifications.show({
        title: 'Upload Successful',
        message: `Successfully uploaded ${parsedRecords.length} SPC Quality Characteristics!`,
        color: 'green',
        icon: <CheckCircle2 size={16} />
      });
      setParsedRecords([]);
      setUploadFile(null);
      refetch();
    } catch (err: any) {
      notifications.show({
        title: 'Upload Failed',
        message: err?.response?.data?.message || 'Failed to upload SPC characteristics.',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const downloadSampleTemplate = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('SPC_Characteristics_Template');

      worksheet.columns = [
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Product Description', key: 'productDescription', width: 25 },
        { header: 'Quality Characteristic', key: 'qualityCharacteristic', width: 30 },
        { header: 'USL', key: 'usl', width: 12 },
        { header: 'LSL', key: 'lsl', width: 12 },
        { header: 'Frequency', key: 'frequency', width: 15 },
      ];

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      worksheet.addRow({ customer: customers[0]?.name || 'General Motors', productDescription: 'Front cover', qualityCharacteristic: 'Seal Bore Diameter', usl: 57.046, lsl: 57.000, frequency: '1/shift' });
      worksheet.addRow({ customer: customers[0]?.name || 'General Motors', productDescription: 'Front cover', qualityCharacteristic: 'Rotor bore diameter', usl: 82.070, lsl: 82.020, frequency: '2/shift' });
      worksheet.addRow({ customer: customers[1]?.name || 'Ford', productDescription: 'Oil pump', qualityCharacteristic: 'Crank bore diameter', usl: 52.020, lsl: 51.990, frequency: '4/shift' });

      // Customer Data Validation (Column A)
      const customerList = customers.map((c: any) => c.name).filter(Boolean);
      const customerFormula = customerList.length > 0 ? `"${customerList.join(',')}"` : '"General Motors,Ford,Toyota"';

      for (let i = 2; i <= 100; i++) {
        worksheet.getCell(`A${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [customerFormula],
          showErrorMessage: true,
          errorTitle: 'Invalid Customer',
          error: 'Please select a Customer from the dropdown list.',
        };

        // Frequency Data Validation (Column F)
        worksheet.getCell(`F${i}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"1/shift,2/shift,4/shift,1/day,2/day"'],
          showErrorMessage: true,
          errorTitle: 'Invalid Frequency',
          error: 'Please select a Frequency option from the dropdown list.',
        };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SPC_Quality_Characteristics_Format.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate Excel template', err);
    }
  };

  // Filter characteristics for display table
  const filteredCharacteristics = characteristics.filter((item: any) => {
    const q = searchQuery.toLowerCase();
    const part = (item.partNumber || '').toLowerCase();
    const desc = (item.productDescription || '').toLowerCase();
    const char = (item.qualityCharacteristic || '').toLowerCase();
    const cust = (item.customer?.name || item.customerName || '').toLowerCase();
    return part.includes(q) || desc.includes(q) || char.includes(q) || cust.includes(q);
  });

  const groupedCharacteristics = useMemo(() => {
    const groups: { [key: string]: { key: string; customerName: string; partNumber: string; customerId?: string; items: any[] } } = {};
    filteredCharacteristics.forEach((item: any) => {
      const custName = item.customer?.name || item.customerName || 'Default Customer';
      const key = `${custName}___${item.partNumber}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          customerName: custName,
          partNumber: item.partNumber,
          customerId: item.customerId || item.customer?.id,
          items: [],
        };
      }
      groups[key].items.push(item);
    });
    return Object.values(groups);
  }, [filteredCharacteristics]);

  const toggleGroupExpand = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Title order={2} className="flex items-center gap-2">
            <Database className="text-blue-600" size={28} />
            SPC Master Data Management
          </Title>
          <Text size="sm" c="dimmed">
            Manage Quality Characteristics, Machine allocations, USL/LSL limits, and frequencies
          </Text>
        </div>
        <Group>
          <Button leftSection={<Plus size={16} />} color="blue" onClick={openCreateModal}>
            Add Quality Characteristic
          </Button>
        </Group>
      </div>

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md">
        <Tabs.List>
          <Tabs.Tab value="characteristics" leftSection={<Database size={16} />}>
            Quality Characteristics ({characteristics.length})
          </Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<Upload size={16} />}>
            Bulk Upload Excel / CSV
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab 1: Characteristics Master Data Table with Full Edit/Delete */}
        <Tabs.Panel value="characteristics" pt="md" className="space-y-4">
          <Paper p="md" radius="lg" withBorder className="shadow-sm bg-white dark:bg-gray-800">
            <Group justify="space-between" mb="md">
              <Group gap="md">
                <TextInput
                  placeholder="Search Part, Description, Characteristic..."
                  leftSection={<Search size={16} />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-80"
                />
              </Group>
            </Group>

            {isLoading ? (
              <div className="space-y-2 p-2">
                <Skeleton height={30} />
                <Skeleton height={30} />
                <Skeleton height={30} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table striped highlightOnHover verticalSpacing="sm" style={{ minWidth: 900 }}>
                  <Table.Thead className="bg-gray-50 dark:bg-[#25262b]">
                    <Table.Tr>
                      <Table.Th style={{ width: 40 }}></Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Part Number</Table.Th>
                      <Table.Th>Total Parameters</Table.Th>
                      <Table.Th style={{ width: 180 }}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {groupedCharacteristics.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={5}>
                          <Text c="dimmed" ta="center" py="xl">
                            No SPC Quality Characteristics found matching criteria.
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      groupedCharacteristics.map((group: any) => {
                        const isExpanded = expandedGroups[group.key] ?? true;
                        return (
                          <>
                            {/* Summary Header Row */}
                            <Table.Tr key={group.key} className="bg-blue-50/40 dark:bg-blue-950/20 font-medium">
                              <Table.Td>
                                <ActionIcon
                                  variant="subtle"
                                  color="blue"
                                  size="sm"
                                  onClick={() => toggleGroupExpand(group.key)}
                                >
                                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </ActionIcon>
                              </Table.Td>
                              <Table.Td>
                                <Text fw={600} size="sm">{group.customerName}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="light" color="blue" size="md">{group.partNumber}</Badge>
                              </Table.Td>
                              <Table.Td>
                                <Badge variant="outline" color="indigo" size="sm">
                                  {group.items.length} Parameter{group.items.length !== 1 ? 's' : ''}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Group gap={6}>
                                  <Tooltip label="Edit Parameter">
                                    <ActionIcon
                                      variant="light"
                                      color="blue"
                                      size="md"
                                      onClick={() => setParameterManagerGroup(group)}
                                    >
                                      <Database size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Edit Part & Customer">
                                    <ActionIcon
                                      variant="light"
                                      color="indigo"
                                      size="md"
                                      onClick={() => {
                                        setGroupEditGroup(group);
                                        setGroupEditCustomer(group.customerId || null);
                                        setGroupEditPartNumber(group.partNumber);
                                      }}
                                    >
                                      <Pencil size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Delete Entire Group Data">
                                    <ActionIcon
                                      variant="light"
                                      color="red"
                                      size="md"
                                      onClick={() => confirmDeleteGroup(group)}
                                    >
                                      <Trash2 size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                </Group>
                              </Table.Td>
                            </Table.Tr>

                            {/* Expanded Child Table */}
                            {isExpanded && (
                              <Table.Tr key={`${group.key}_details`}>
                                <Table.Td colSpan={5} style={{ padding: 0 }}>
                                  <div className="p-3 bg-gray-50/70 dark:bg-[#1a1b1e] border-y border-gray-200 dark:border-gray-700">
                                    <Table verticalSpacing="xs" striped highlightOnHover className="bg-white dark:bg-gray-800 rounded-md overflow-hidden shadow-inner">
                                      <Table.Thead className="bg-gray-100 dark:bg-gray-900 text-xs">
                                        <Table.Tr>
                                          <Table.Th>Product Description</Table.Th>
                                          <Table.Th>Quality Characteristic</Table.Th>
                                          <Table.Th>USL</Table.Th>
                                          <Table.Th>LSL</Table.Th>
                                          <Table.Th>Frequency</Table.Th>
                                          <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                                        </Table.Tr>
                                      </Table.Thead>
                                      <Table.Tbody>
                                        {group.items.map((item: any) => (
                                          <Table.Tr key={item.id}>
                                            <Table.Td>
                                              <Text size="sm">{item.productDescription || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Text fw={600} size="sm" className="text-gray-900 dark:text-gray-100">
                                                {item.qualityCharacteristic}
                                              </Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Text size="sm" fw={600} c="green">
                                                {item.usl !== null && item.usl !== undefined ? item.usl : '-'}
                                              </Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Text size="sm" fw={600} c="red">
                                                {item.lsl !== null && item.lsl !== undefined ? item.lsl : '-'}
                                              </Text>
                                            </Table.Td>
                                            <Table.Td>
                                              <Badge color="violet" variant="light" size="xs">
                                                {item.frequency || '1/shift'}
                                              </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                              <Group gap={6}>
                                                <Tooltip label="Edit Characteristic">
                                                  <ActionIcon variant="light" color="blue" size="sm" onClick={() => openEditModal(item)}>
                                                    <Pencil size={14} />
                                                  </ActionIcon>
                                                </Tooltip>
                                                <Tooltip label="Delete Characteristic">
                                                  <ActionIcon variant="light" color="red" size="sm" onClick={() => confirmDelete(item)}>
                                                    <Trash2 size={14} />
                                                  </ActionIcon>
                                                </Tooltip>
                                              </Group>
                                            </Table.Td>
                                          </Table.Tr>
                                        ))}
                                      </Table.Tbody>
                                    </Table>
                                  </div>
                                </Table.Td>
                              </Table.Tr>
                            )}
                          </>
                        );
                      })
                    )}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Tab 2: Bulk Upload Excel matching User Screenshot Format */}
        <Tabs.Panel value="upload" pt="md" className="space-y-6">
          <Paper p="md" radius="lg" withBorder className="shadow-sm bg-white dark:bg-gray-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <Title order={4}>Upload SPC Characteristics Excel Sheet</Title>
                <Text size="xs" c="dimmed">
                  Upload file containing: Customer | Product Description | Quality Characteristic | USL | LSL | Frequency
                </Text>
              </div>
              <Button
                variant="outline"
                color="blue"
                size="xs"
                leftSection={<FileSpreadsheet size={14} />}
                onClick={downloadSampleTemplate}
              >
                Download Excel Format Template
              </Button>
            </div>

            <div className="bg-gray-50 dark:bg-[#1a1b1e] p-4 rounded-md border border-gray-200 dark:border-gray-700 mb-4">
              <Title order={5} mb="sm">Part Selection</Title>
              <Checkbox
                label="This is a new part not in the system yet"
                checked={isNewPart}
                onChange={(event) => setIsNewPart(event.currentTarget.checked)}
                mb="md"
              />

              {isNewPart ? (
                <Group mb="sm">
                  <TextInput
                    label="Part Number"
                    placeholder="e.g. WPA977M1"
                    value={newPartNumber}
                    onChange={(e) => setNewPartNumber(e.target.value)}
                    required
                    style={{ width: 250 }}
                  />
                  <TextInput
                    label="Part Name (Optional)"
                    placeholder="e.g. WP Body"
                    value={newPartName}
                    onChange={(e) => setNewPartName(e.target.value)}
                    style={{ width: 250 }}
                  />
                </Group>
              ) : (
                <Select
                  label="Select Existing Part"
                  description="Choose the part this SPC data belongs to before uploading."
                  placeholder="Search and select part"
                  data={parts.map((p: any) => ({ value: p.id, label: `${p.partNumber} - ${p.partName}` }))}
                  value={selectedPart}
                  onChange={setSelectedPart}
                  searchable
                  required
                  mb="sm"
                  style={{ maxWidth: 400 }}
                />
              )}
            </div>

            <Group gap="md">
              <FileInput
                placeholder="Choose Excel File (.xlsx, .xls)"
                accept=".xlsx,.xls"
                leftSection={<Upload size={16} />}
                value={uploadFile}
                onChange={handleFileChange}
                disabled={(!isNewPart && !selectedPart) || (isNewPart && !newPartNumber)}
                className="w-full sm:w-80"
              />
              {parsedRecords.length > 0 && (
                <Button
                  color="blue"
                  leftSection={<Upload size={16} />}
                  onClick={handleBatchUpload}
                  loading={uploading}
                >
                  Upload {parsedRecords.length} Characteristics
                </Button>
              )}
            </Group>

            {parsedRecords.length > 0 && (
              <div className="mt-4">
                <Text fw={600} size="sm" mb="xs">Parsed File Preview ({parsedRecords.length} items):</Text>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Product Description</Table.Th>
                      <Table.Th>Part Number</Table.Th>
                      <Table.Th>Quality Characteristic</Table.Th>
                      <Table.Th>USL</Table.Th>
                      <Table.Th>LSL</Table.Th>
                      <Table.Th>Frequency</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {parsedRecords.slice(0, 10).map((r, i) => (
                      <Table.Tr key={i}>
                        <Table.Td>{i + 1}</Table.Td>
                        <Table.Td>{r.customerName || '-'}</Table.Td>
                        <Table.Td>{r.productDescription || '-'}</Table.Td>
                        <Table.Td><Badge size="xs" color="blue">{r.partNumber}</Badge></Table.Td>
                        <Table.Td className="font-semibold">{r.qualityCharacteristic}</Table.Td>
                        <Table.Td className="text-green-600 font-semibold">{r.usl ?? '-'}</Table.Td>
                        <Table.Td className="text-red-600 font-semibold">{r.lsl ?? '-'}</Table.Td>
                        <Table.Td>{r.frequency}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Edit / Create Modal */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={editingId ? 'Edit SPC Quality Characteristic' : 'Add New SPC Quality Characteristic'}
        size="lg"
        centered
        zIndex={400}
      >
        <div className="space-y-4">
          <SimpleGrid cols={2} spacing="md">
            <TextInput
              label="Product Description"
              placeholder="e.g. Front cover, Oil pump"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            />
            <TextInput
              label="Part Number"
              placeholder="e.g. IFC895M1"
              required
              value={partNumber}
              onChange={(e) => setPartNumber(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={2} spacing="md">
            <Select
              label="Customer"
              placeholder="Assign to Customer"
              data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
              value={customerId}
              onChange={setCustomerId}
              clearable
              searchable
            />
          </SimpleGrid>

          <SimpleGrid cols={1} spacing="md">
            <TextInput
              label="Quality Characteristic"
              placeholder="e.g. Seal Bore Diameter"
              required
              value={qualityCharacteristic}
              onChange={(e) => setQualityCharacteristic(e.target.value)}
            />
          </SimpleGrid>

          <SimpleGrid cols={3} spacing="md">
            <NumberInput
              label="USL (Upper Spec Limit)"
              placeholder="e.g. 57.046"
              value={usl}
              onChange={(v) => setUsl(v as number | '')}
              decimalScale={4}
            />
            <NumberInput
              label="LSL (Lower Spec Limit)"
              placeholder="e.g. 57.000"
              value={lsl}
              onChange={(v) => setLsl(v as number | '')}
              decimalScale={4}
            />
            <Select
              label="Frequency Option"
              placeholder="Select Frequency"
              data={[
                { value: '1/shift', label: 'Shift wise 1 (1/shift)' },
                { value: '2/shift', label: 'Shift wise 2 (2/shift)' },
                { value: '4/shift', label: 'Shift wise 4 (4/shift)' },
                { value: '1/day', label: 'Day wise 1 (1/day)' },
                { value: '2/day', label: 'Day wise 2 (2/day)' },
              ]}
              value={frequency}
              onChange={setFrequency}
            />
          </SimpleGrid>

          <Group justify="end" mt="md">
            <Button variant="default" onClick={closeModal}>Cancel</Button>
            <Button
              color="blue"
              onClick={() => (editingId ? updateMutation.mutate() : createMutation.mutate())}
              loading={createMutation.isPending || updateMutation.isPending}
              disabled={!partNumber.trim() || !qualityCharacteristic.trim()}
            >
              {editingId ? 'Save Changes' : 'Create Characteristic'}
            </Button>
          </Group>
        </div>
      </Modal>

      {/* Edit Group (Part Number / Customer) Modal */}
      <Modal
        opened={!!groupEditGroup}
        onClose={() => setGroupEditGroup(null)}
        title={`Edit Part Number & Customer - ${groupEditGroup?.partNumber || ''}`}
        centered
      >
        <div className="space-y-4">
          <Select
            label="Customer"
            placeholder="Select Customer"
            data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
            value={groupEditCustomer}
            onChange={setGroupEditCustomer}
            clearable
            searchable
          />
          <TextInput
            label="Part Number"
            placeholder="e.g. IFC895M1"
            required
            value={groupEditPartNumber}
            onChange={(e) => setGroupEditPartNumber(e.target.value)}
          />
          <Group justify="end" mt="md">
            <Button variant="default" onClick={() => setGroupEditGroup(null)}>Cancel</Button>
            <Button color="blue" onClick={handleGroupEditSave}>Save Changes</Button>
          </Group>
        </div>
      </Modal>

      {/* Parameter Manager Modal */}
      <Modal
        opened={!!parameterManagerGroup}
        onClose={() => setParameterManagerGroup(null)}
        title={`Parameter Manager - Customer: ${parameterManagerGroup?.customerName || ''} | Part Number: ${parameterManagerGroup?.partNumber || ''}`}
        size="70%"
        centered
      >
        {parameterManagerGroup && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Text size="xs" c="dimmed">Add, edit, or remove parameter specifications for this Part Number.</Text>
              <Button
                size="xs"
                color="blue"
                leftSection={<Plus size={14} />}
                onClick={() => openCreateModalForGroup(parameterManagerGroup)}
              >
                Add New Parameter
              </Button>
            </div>

            <Table verticalSpacing="xs" striped highlightOnHover>
              <Table.Thead className="bg-gray-100 dark:bg-gray-800">
                <Table.Tr>
                  <Table.Th>Product Description</Table.Th>
                  <Table.Th>Quality Characteristic</Table.Th>
                  <Table.Th>USL</Table.Th>
                  <Table.Th>LSL</Table.Th>
                  <Table.Th>Frequency</Table.Th>
                  <Table.Th style={{ width: 100 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {parameterManagerGroup.items.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td><Text size="sm">{item.productDescription || '-'}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={600}>{item.qualityCharacteristic}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={600} c="green">{item.usl ?? '-'}</Text></Table.Td>
                    <Table.Td><Text size="sm" fw={600} c="red">{item.lsl ?? '-'}</Text></Table.Td>
                    <Table.Td><Badge color="violet" variant="light" size="xs">{item.frequency || '1/shift'}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <ActionIcon variant="light" color="blue" size="sm" onClick={() => openEditModal(item)}>
                          <Pencil size={14} />
                        </ActionIcon>
                        <ActionIcon variant="light" color="red" size="sm" onClick={() => confirmDelete(item)}>
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
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
