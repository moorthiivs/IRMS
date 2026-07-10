import { useState, useRef, useEffect } from 'react';
import { Group, Title, Button, Paper, Table, Avatar, Text, Badge, Tooltip, ActionIcon, Modal, Stack, TextInput, Select, FileInput, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersIcon, Plus, Edit, PenTool, Trash2, Upload } from 'lucide-react';
import { usersService } from '../services/users.service';
import { notifications } from '@mantine/notifications';
import { User } from '../types';
import SignaturePad from 'signature_pad';
import { TableSkeleton } from '../components/TableSkeleton';
import { masterDataService } from '../services/master-data.service';
export function UserManagement() {
  const queryClient = useQueryClient();
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [sigUser, setSigUser] = useState<User | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<string>('INSPECTOR');
  const [formCustomerId, setFormCustomerId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersService.getAll,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: masterDataService.getCustomers,
  });

  const createMutation = useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({ title: 'User Created', message: 'New user has been created.', color: 'green' });
      closeCreate();
      resetForm();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to create user.', color: 'red' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({ title: 'User Updated', message: 'User has been updated.', color: 'green' });
      setEditUser(null);
      resetForm();
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to update user.', color: 'red' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({ title: 'User Deleted', message: 'User has been removed.', color: 'green' });
    },
    onError: (err: any) => {
      notifications.show({ title: 'Error', message: err?.response?.data?.message || 'Failed to delete user.', color: 'red' });
    },
  });

  const sigMutation = useMutation({
    mutationFn: ({ id, signature }: { id: string; signature: string }) =>
      usersService.updateSignature(id, signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notifications.show({ title: 'Signature Saved', message: 'Signature has been updated.', color: 'green' });
      setSigUser(null);
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormEmail('');
    setFormRole('INSPECTOR');
    setFormCustomerId(null);
  };

  const handleCreate = () => {
    createMutation.mutate({
      username: formUsername,
      password: formPassword,
      name: formName,
      email: formEmail || undefined,
      role: formRole as 'ADMIN' | 'INSPECTOR' | 'SUPERVISOR' | 'OPERATOR',
      customerId: (formRole !== 'ADMIN') ? formCustomerId : null,
    });
  };

  const handleUpdate = () => {
    if (!editUser) return;
    const data: any = {
      name: formName,
      email: formEmail || undefined,
      role: formRole,
      customerId: (formRole !== 'ADMIN') ? formCustomerId : null,
    };
    if (formPassword) data.password = formPassword;
    updateMutation.mutate({ id: editUser.id, data });
  };

  const openEditModal = (user: User) => {
    setEditUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormEmail((user as any).email || '');
    setFormRole(user.role);
    setFormCustomerId(user.customerId || null);
    setFormPassword('');
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <UsersIcon size={28} />
          <Title order={2}>User Management</Title>
        </Group>
        <Button leftSection={<Plus size={16} />} onClick={openCreate}>
          Create User
        </Button>
      </Group>

      <Paper withBorder radius="md">
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={5} /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table striped highlightOnHover style={{ minWidth: 700 }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Username</Table.Th>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Signature</Table.Th>
                  <Table.Th style={{ minWidth: 120 }}>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.length === 0 ? (
                  <Table.Tr>
                    <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#868e96' }}>
                      No users found.
                    </Table.Td>
                  </Table.Tr>
                ) : (
                  users.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Group gap="sm">
                          <Avatar color={user.role === 'ADMIN' ? 'violet' : 'blue'} radius="xl" size="sm">
                            {user.name.charAt(0)}
                          </Avatar>
                          <Text fw={500}>{user.name}</Text>
                        </Group>
                      </Table.Td>
                      <Table.Td>{user.username}</Table.Td>
                      <Table.Td>
                        <Badge color={user.role === 'ADMIN' ? 'violet' : (user.role === 'SUPERVISOR' ? 'indigo' : 'blue')} variant="light">
                          {user.role}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {user.customer ? (
                          <Text size="sm">{user.customer.name}</Text>
                        ) : (
                          <Text size="xs" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {user.signature ? (
                          <img
                            src={user.signature}
                            alt="Signature"
                            style={{ height: 30, background: '#f8f9fa', borderRadius: 4, border: '1px solid #dee2e6' }}
                          />
                        ) : (
                          <Text size="xs" c="dimmed">Not set</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Group gap={4} wrap="nowrap">
                          <Tooltip label="Edit User">
                            <ActionIcon variant="subtle" color="blue" onClick={() => openEditModal(user)}>
                              <Edit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Draw Signature">
                            <ActionIcon variant="subtle" color="green" onClick={() => setSigUser(user)}>
                              <PenTool size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete User">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => {
                                if (confirm(`Delete user "${user.name}"?`)) {
                                  deleteMutation.mutate(user.id);
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </div>
        )}
      </Paper>

      {/* Create User Modal */}
      <Modal opened={createOpened} onClose={closeCreate} title="Create New User" centered>
        <Stack gap="sm">
          <TextInput label="Full Name" placeholder="John Doe" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          <TextInput label="Username" placeholder="johndoe" value={formUsername} onChange={(e) => setFormUsername(e.target.value)} required />
          <TextInput label="Email (Optional)" placeholder="john@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          <TextInput label="Password" type="password" placeholder="Min 4 characters" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required />
          <Select
            label="Role"
            data={[
              { value: 'INSPECTOR', label: 'Inspector' },
              { value: 'OPERATOR', label: 'Operator' },
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
            value={formRole}
            onChange={(v) => setFormRole(v || 'INSPECTOR')}
          />
          {formRole !== 'ADMIN' && (
            <Select
              label="Assigned Customer"
              placeholder="Select a customer"
              data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
              value={formCustomerId}
              onChange={setFormCustomerId}
              required
            />
          )}
          <Button
            fullWidth
            mt="sm"
            onClick={handleCreate}
            loading={createMutation.isPending}
            disabled={!formName || !formUsername || !formPassword}
          >
            Create User
          </Button>
        </Stack>
      </Modal>

      {/* Edit User Modal */}
      <Modal opened={!!editUser} onClose={() => { setEditUser(null); resetForm(); }} title={`Edit: ${editUser?.name}`} centered>
        <Stack gap="sm">
          <TextInput label="Full Name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
          <TextInput label="Username" value={formUsername} disabled description="Username cannot be changed" />
          <TextInput label="Email (Optional)" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
          <TextInput label="New Password" type="password" placeholder="Leave blank to keep current" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} />
          <Select
            label="Role"
            data={[
              { value: 'INSPECTOR', label: 'Inspector' },
              { value: 'OPERATOR', label: 'Operator' },
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'ADMIN', label: 'Admin' },
            ]}
            value={formRole}
            onChange={(v) => setFormRole(v || 'INSPECTOR')}
          />
          {formRole !== 'ADMIN' && (
            <Select
              label="Assigned Customer"
              placeholder="Select a customer"
              data={customers.map((c: any) => ({ value: c.id, label: c.name }))}
              value={formCustomerId}
              onChange={setFormCustomerId}
              required
            />
          )}
          <Button
            fullWidth
            mt="sm"
            onClick={handleUpdate}
            loading={updateMutation.isPending}
            disabled={!formName}
          >
            Save Changes
          </Button>
        </Stack>
      </Modal>

      {/* Signature Pad Modal */}
      <Modal
        opened={!!sigUser}
        onClose={() => setSigUser(null)}
        title={`Draw Signature: ${sigUser?.name}`}
        centered
        size="lg"
      >
        {sigUser && (
          <SignaturePadCanvas
            existingSignature={sigUser.signature || null}
            onSave={(dataUrl) => {
              sigMutation.mutate({ id: sigUser.id, signature: dataUrl });
            }}
            saving={sigMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

// Signature Pad Canvas Component
function SignaturePadCanvas({
  existingSignature,
  onSave,
  saving,
}: {
  existingSignature: string | null;
  onSave: (dataUrl: string) => void;
  saving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    // Set canvas size
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext('2d')?.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: 'rgba(0, 0, 0, 0)', // Transparent
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 2.5,
    });

    signaturePadRef.current = pad;

    // Load existing signature if present
    if (existingSignature) {
      pad.fromDataURL(existingSignature, {
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
      });
    }

    return () => {
      pad.off();
    };
  }, [existingSignature]);

  const handleImageUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          if (r > 180 && g > 180 && b > 180) {
            data[i + 3] = 0; // Transparent
          } else {
            // Dark pixels
            data[i] = 20;
            data[i + 1] = 30;
            data[i + 2] = 50;
            data[i + 3] = 255;
          }
        }
        ctx.putImageData(imageData, 0, 0);

        signaturePadRef.current?.clear();
        signaturePadRef.current?.fromDataURL(tempCanvas.toDataURL('image/png'), {
          width: canvasRef.current?.offsetWidth || img.width,
          height: canvasRef.current?.offsetHeight || img.height,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };
  const handleClear = () => {
    signaturePadRef.current?.clear();
  };

  const cropSignatureCanvas = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas.toDataURL('image/png');

    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let hasPixels = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
    }

    if (!hasPixels) return canvas.toDataURL('image/png');

    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tempCtx = tempCanvas.getContext('2d');

    if (tempCtx) {
      tempCtx.putImageData(ctx.getImageData(minX, minY, cropW, cropH), 0, 0);
      return tempCanvas.toDataURL('image/png');
    }

    return canvas.toDataURL('image/png');
  };

  const handleSave = () => {
    if (!signaturePadRef.current || !canvasRef.current) return;
    if (signaturePadRef.current.isEmpty()) {
      notifications.show({ title: 'Error', message: 'Please draw a signature first.', color: 'red' });
      return;
    }
    const croppedDataUrl = cropSignatureCanvas(canvasRef.current);
    onSave(croppedDataUrl);
  };

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Draw your signature in the box below using mouse or touch. This standardized signature
        will be used in inspection reports.
      </Text>

      <FileInput
        label="Upload Signature Image"
        placeholder="Click to upload an image of your signature"
        accept="image/png,image/jpeg,image/jpg"
        leftSection={<Upload size={16} />}
        onChange={handleImageUpload}
        clearable
      />

      <Divider my="xs" label="OR DRAW BELOW" labelPosition="center" />

      <div
        style={{
          border: '2px dashed #dee2e6',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#fff',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 200,
            display: 'block',
            cursor: 'crosshair',
          }}
        />
      </div>
      <Group justify="space-between">
        <Button variant="subtle" color="gray" onClick={handleClear}>
          Clear
        </Button>
        <Button onClick={handleSave} loading={saving}>
          Save Signature
        </Button>
      </Group>
    </Stack>
  );
}
