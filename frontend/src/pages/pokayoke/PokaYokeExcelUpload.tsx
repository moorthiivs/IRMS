import { useState, useCallback } from 'react';
import { Title, Paper, Group, Text, Button, Select, Checkbox, TextInput, Table } from '@mantine/core';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { UploadCloud, Check, FileSpreadsheet, X, Download } from 'lucide-react';
import api from '../../lib/axios';
import { masterDataService } from '../../services/master-data.service';
import * as xlsx from 'xlsx';

export function PokaYokeExcelUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [isNewPart, setIsNewPart] = useState(false);
  const [newPartNumber, setNewPartNumber] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: masterDataService.getParts,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, partId, partNumber, partName }: { file: File, partId?: string, partNumber?: string, partName?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (partId) formData.append('partId', partId);
      if (partNumber) formData.append('partNumber', partNumber);
      if (partName) formData.append('partName', partName);
      const { data } = await api.post('/pokayoke/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      notifications.show({
        title: 'Upload Successful',
        message: `Successfully imported ${data.imported} records!`,
        color: 'green',
        icon: <Check size={16} />,
      });
      setSelectedFile(null);
      setSelectedPart(null);
      setNewPartNumber('');
      setNewPartName('');
      setIsNewPart(false);
      setPreviewData([]);
      onUploadSuccess?.();
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Upload Failed',
        message: err.response?.data?.message || 'Failed to import data',
        color: 'red',
        icon: <X size={16} />,
      });
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setSelectedFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (data) {
          try {
            const workbook = xlsx.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const parsedData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
            const nonEmptyRows = parsedData.filter((row: any) => row.length > 0);
            setPreviewData(nonEmptyRows.slice(0, 6)); // 1 header + 5 rows
          } catch (error) {
            console.error("Failed to parse Excel file", error);
          }
        }
      };
      reader.readAsBinaryString(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
  });

  const handleConfirmUpload = () => {
    if (selectedFile) {
      if (isNewPart && newPartNumber && newPartName) {
        uploadMutation.mutate({ file: selectedFile, partNumber: newPartNumber, partName: newPartName });
      } else if (!isNewPart && selectedPart) {
        uploadMutation.mutate({ file: selectedFile, partId: selectedPart });
      }
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/upload_poka_yoke.xlsx');
      if (!response.ok) throw new Error('Template file not found');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'upload_poka_yoke.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      notifications.show({
        title: 'Download Failed',
        message: 'Failed to download template file',
        color: 'red',
        icon: <X size={16} />,
      });
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Poka Yoke Master Data Upload</Title>
        <Button
          variant="light"
          leftSection={<Download size={16} />}
          onClick={handleDownloadTemplate}
        >
          Download Template
        </Button>
      </Group>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Part Information */}
        <Paper withBorder p="md" radius="md" className="h-fit">
          <Title order={4} mb="md">Part Details</Title>
          <Checkbox
            label="This is a new part not in the system yet"
            checked={isNewPart}
            onChange={(event) => setIsNewPart(event.currentTarget.checked)}
            mb="md"
          />

          {isNewPart ? (
            <Group mb="xl">
              <TextInput
                label="Part Number"
                placeholder="e.g. WPA977M1"
                value={newPartNumber}
                onChange={(e) => setNewPartNumber(e.target.value)}
                required
                style={{ width: 250 }}
              />
              <TextInput
                label="Part Name"
                placeholder="e.g. WP Body"
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                required
                style={{ width: 250 }}
              />
            </Group>
          ) : (
            <Select
              label="Select Part"
              description="Choose the part this Poka Yoke data belongs to before uploading."
              placeholder="Search and select part"
              data={parts.map((p: any) => ({ value: p.id, label: `${p.partNumber} - ${p.partName}` }))}
              value={selectedPart}
              onChange={setSelectedPart}
              searchable
              required
              mb="xl"
            />
          )}
        </Paper>

        {/* Right Column: Upload Box & Preview */}
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="md">Upload Data</Title>
          <Paper
            withBorder
            p="xl"
            radius="md"
            className={`flex flex-col items-center justify-center border-dashed border-2 transition-colors cursor-pointer min-h-[250px] ${(!isNewPart && !selectedPart) || (isNewPart && (!newPartNumber || !newPartName)) ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
              } ${isDragActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-800' : 'bg-gray-50 dark:bg-[#1a1b1e] hover:bg-gray-100 dark:hover:bg-[#25262b]'
              }`}
            {...getRootProps()}
          >
            <input {...getInputProps()} disabled={(!isNewPart && !selectedPart) || (isNewPart && (!newPartNumber || !newPartName))} />
            {selectedFile ? (
              <>
                <FileSpreadsheet size={48} className="text-green-500 mb-4" />
                <Text size="lg" fw={600} mb="xs">{selectedFile.name}</Text>
                <Text c="dimmed" size="sm" mb="md">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </Text>
              </>
            ) : (
              <>
                <UploadCloud size={48} className="text-gray-400 mb-4" />
                <Text size="xl" fw={600} mb="sm" ta="center">Drag & Drop Poka Yoke Excel File</Text>
                <Text c="dimmed" size="sm" mb="xl" ta="center">Only .xlsx or .xls files are supported</Text>
                <Button disabled={(!isNewPart && !selectedPart) || (isNewPart && (!newPartNumber || !newPartName))}>Browse Files</Button>
              </>
            )}
          </Paper>

          {selectedFile && (
            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                color="gray"
                onClick={() => { setSelectedFile(null); setPreviewData([]); }}
              >
                Clear
              </Button>
              <Button
                color="green"
                leftSection={<UploadCloud size={16} />}
                onClick={handleConfirmUpload}
                loading={uploadMutation.isPending}
                disabled={(!isNewPart && !selectedPart) || (isNewPart && (!newPartNumber || !newPartName)) || !selectedFile}
              >
                Upload & Import
              </Button>
            </Group>
          )}


        </Paper>
      </div>

      {previewData.length > 0 && (
        <div className="mt-xl">
          <Text fw={600} mb="xs">Data Preview (First 5 Rows)</Text>
          <div className="overflow-x-auto">
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  {previewData[0].map((cell: any, j: number) => (
                    <Table.Th key={j}>{cell}</Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {previewData.slice(1).map((row, i) => (
                  <Table.Tr key={i}>
                    {row.map((cell: any, j: number) => (
                      <Table.Td key={j}>{cell}</Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
