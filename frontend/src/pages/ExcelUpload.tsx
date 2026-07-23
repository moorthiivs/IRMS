import { useState, useCallback } from 'react';
import { Title, Paper, Group, Text, Button, Table, Badge, Alert, Loader } from '@mantine/core';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { UploadCloud, Download, Check, AlertCircle, FileSpreadsheet, X, Trash2 } from 'lucide-react';
import { masterDataService } from '../services/master-data.service';

export function ExcelUpload({ onUploadSuccess }: { onUploadSuccess?: () => void }) {
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);

  // Fetch upload history from backend
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['upload-history'],
    queryFn: masterDataService.getUploadHistory,
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (file: File) => masterDataService.previewUpload(file),
    onSuccess: (data) => {
      setPreviewData(data);
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Preview Failed',
        message: err.response?.data?.message || 'Failed to parse file',
        color: 'red',
        icon: <X size={16} />,
      });
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => masterDataService.uploadData(file),
    onSuccess: (data) => {
      notifications.show({
        title: 'Upload Successful',
        message: data.message || 'Master data imported successfully!',
        color: 'green',
        icon: <Check size={16} />,
      });
      setSelectedFile(null);
      setPreviewData(null);
      queryClient.invalidateQueries({ queryKey: ['upload-history'] });
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      queryClient.invalidateQueries({ queryKey: ['operations'] });
      queryClient.invalidateQueries({ queryKey: ['parameters'] });
      queryClient.invalidateQueries({ queryKey: ['parts-with-operations'] });
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
      setPreviewData(null);
      previewMutation.mutate(file);
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
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setPreviewData(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/upload_template.xlsx');
      if (!response.ok) throw new Error('Template file not found');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'upload_template.xlsx');
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
        <Title order={2}>Master Data Upload</Title>
        <Button 
          variant="light" 
          leftSection={<Download size={16} />}
          onClick={handleDownloadTemplate}
        >
          Download Template
        </Button>
      </Group>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dropzone */}
        <Paper
          withBorder
          p="xl"
          radius="md"
          className={`flex flex-col items-center justify-center border-dashed border-2 transition-colors cursor-pointer min-h-[300px] ${
            isDragActive ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-400 dark:border-blue-800' : 'bg-gray-50 dark:bg-[#1a1b1e] hover:bg-gray-100 dark:hover:bg-[#25262b]'
          }`}
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          {selectedFile ? (
            <>
              <FileSpreadsheet size={48} className="text-green-500 mb-4" />
              <Text size="lg" fw={600} mb="xs">{selectedFile.name}</Text>
              <Text c="dimmed" size="sm" mb="md">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </Text>
              {previewMutation.isPending && (
                <Group gap="xs">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Parsing file...</Text>
                </Group>
              )}
            </>
          ) : (
            <>
              <UploadCloud size={48} className="text-gray-400 mb-4" />
              <Text size="xl" fw={600} mb="sm">Drag & Drop Excel File</Text>
              <Text c="dimmed" size="sm" mb="xl">Only .xlsx or .xls files are supported</Text>
              <Button>Browse Files</Button>
            </>
          )}
        </Paper>

        {/* Upload History */}
        <Paper withBorder p="md" radius="md">
          <Title order={4} mb="md">Upload History</Title>
          {historyLoading ? (
            <Group justify="center" py="xl"><Loader /></Group>
          ) : history.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">No uploads yet</Text>
          ) : (
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>File</Table.Th>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Records</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.map((item: any) => (
                    <Table.Tr key={item.id}>
                      <Table.Td className="max-w-[150px] truncate">{item.filename}</Table.Td>
                      <Table.Td>{new Date(item.uploadTimestamp).toLocaleString()}</Table.Td>
                      <Table.Td>
                        <Badge color={
                          item.status === 'SUCCESS' ? 'green' : 
                          item.status === 'PARTIAL' ? 'yellow' : 'red'
                        }>
                          {item.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{item.importedRecords}/{item.totalRecords}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Paper>
      </div>

      {/* Preview Section */}
      {previewData && (
        <Paper withBorder p="md" radius="md" mt="xl">
          <Group justify="space-between" mb="md">
            <Title order={4}>
              Preview ({previewData.rows?.length || 0} rows)
            </Title>
            <Group>
              <Button 
                variant="subtle" 
                color="gray" 
                leftSection={<Trash2 size={16} />}
                onClick={handleClearFile}
              >
                Clear
              </Button>
              <Button
                color={previewData.isValid ? 'green' : 'red'}
                leftSection={<UploadCloud size={16} />}
                onClick={handleConfirmUpload}
                loading={uploadMutation.isPending}
                disabled={!previewData.isValid}
              >
                {previewData.isValid ? 'Confirm & Import' : 'Fix Errors First'}
              </Button>
            </Group>
          </Group>

          {previewData.errors?.length > 0 && (
            <Alert 
              icon={<AlertCircle size={16} />} 
              title={`${previewData.errors.length} Validation Error(s)`} 
              color="red" 
              mb="md"
            >
              <ul className="list-disc pl-4">
                {previewData.errors.slice(0, 10).map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
                {previewData.errors.length > 10 && (
                  <li>...and {previewData.errors.length - 10} more errors</li>
                )}
              </ul>
            </Alert>
          )}

          {previewData.isValid && (
            <Alert icon={<Check size={16} />} title="Validation Passed" color="green" mb="md">
              All {previewData.rows?.length} rows are valid and ready to import.
            </Alert>
          )}

          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table striped highlightOnHover>
              <Table.Thead className="sticky top-0 bg-white dark:bg-[#1a1b1e] z-10">
                <Table.Tr>
                  <Table.Th>Row</Table.Th>
                  <Table.Th>Part No</Table.Th>
                  <Table.Th>Operation</Table.Th>
                  <Table.Th>Parameter</Table.Th>
                  <Table.Th>Spec</Table.Th>
                  <Table.Th>Min</Table.Th>
                  <Table.Th>Max</Table.Th>
                  <Table.Th>Method</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {previewData.rows?.map((row: any) => (
                  <Table.Tr key={row.rowNumber}>
                    <Table.Td>{row.rowNumber}</Table.Td>
                    <Table.Td className="font-semibold">{row.partNumber}</Table.Td>
                    <Table.Td>{row.operationNumber}</Table.Td>
                    <Table.Td>{row.parameterName}</Table.Td>
                    <Table.Td>{row.specText || '-'}</Table.Td>
                    <Table.Td>{row.controlLimitMin ?? '-'}</Table.Td>
                    <Table.Td>{row.controlLimitMax ?? '-'}</Table.Td>
                    <Table.Td>{row.methodOfChecking || '-'}</Table.Td>
                    <Table.Td>
                      {row.errors?.length > 0 ? (
                        <Badge color="red" size="sm">ERROR</Badge>
                      ) : (
                        <Badge color="green" size="sm">OK</Badge>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </Paper>
      )}
    </div>
  );
}
