import React, { useRef, useState } from 'react';
import { Group, Text, Button, Paper, Stack, Badge, Tooltip } from '@mantine/core';
import { Upload, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { notifications } from '@mantine/notifications';

interface ReportLogoUploaderProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

export function ReportLogoUploader({ value, onChange }: ReportLogoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    const validExtensions = ['.png', '.jpg', '.jpeg'];
    
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some(ext => fileName.endsWith(ext));
    const hasValidType = validTypes.includes(file.type);

    if (!hasValidExt || !hasValidType) {
      notifications.show({
        title: 'Invalid File Format',
        message: 'Only PNG and JPG/JPEG format images are allowed for report logo.',
        color: 'red',
        icon: <AlertCircle size={18} />,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Optimize logo dimensions using canvas (max 400x200 while preserving aspect ratio)
        const maxWidth = 400;
        const maxHeight = 200;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const optimizedDataUrl = canvas.toDataURL(outputFormat, 0.92);
          onChange(optimizedDataUrl);
          notifications.show({
            title: 'Logo Selected',
            message: 'Report logo loaded successfully. Click "Save Template Settings" to apply.',
            color: 'green',
          });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  return (
    <Stack gap="xs">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text size="sm" fw={600}>Report Header Logo</Text>
          <Badge variant="light" color="blue" size="xs">PNG / JPG Only</Badge>
        </Group>
        {value && (
          <Tooltip label="Remove custom logo and revert to default logo">
            <Button
              variant="subtle"
              color="red"
              size="xs"
              leftSection={<Trash2 size={14} />}
              onClick={() => onChange(null)}
            >
              Remove Logo
            </Button>
          </Tooltip>
        )}
      </Group>

      <Paper
        withBorder
        p="md"
        radius="md"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          borderStyle: isDragging ? 'dashed' : 'solid',
          borderColor: isDragging ? 'var(--mantine-color-blue-6)' : undefined,
          backgroundColor: isDragging ? 'var(--mantine-color-blue-0)' : undefined,
          transition: 'all 0.2s ease',
        }}
      >
        <Group justify="space-between" align="center" wrap="wrap" gap="md">
          {/* Logo Preview Area */}
          <Paper
            withBorder
            p="xs"
            radius="sm"
            bg="gray.0"
            className="dark:bg-[#1a1b1e] flex items-center justify-center min-w-[140px] h-[70px] max-w-[200px]"
          >
            {value ? (
              <img
                src={value}
                alt="Report Logo Preview"
                style={{
                  maxHeight: '54px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Group gap={6} justify="center" c="dimmed">
                <ImageIcon size={20} />
                <Text size="xs" fw={500}>Default TVS Logo</Text>
              </Group>
            )}
          </Paper>

          {/* Action & Info */}
          <Stack gap={4} style={{ flex: 1, minWidth: '200px' }}>
            <Text size="xs" c="dimmed">
              Upload custom company/client logo for inspection & Poka-Yoke daily report headers.
            </Text>
            <Group gap="xs" mt={4}>
              <Button
                variant="light"
                size="xs"
                leftSection={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                {value ? 'Change Logo' : 'Upload Logo'}
              </Button>
              <Text size="xs" c="dimmed">
                (Formats allowed: .png, .jpg, .jpeg)
              </Text>
            </Group>
          </Stack>
        </Group>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/png, image/jpeg, image/jpg, .png, .jpg, .jpeg"
          style={{ display: 'none' }}
        />
      </Paper>
    </Stack>
  );
}
