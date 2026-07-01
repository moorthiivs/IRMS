import { Container, Title, Text, Button, Group } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <Container className="flex flex-col items-center justify-center min-h-[80vh] text-center">
      <ShieldAlert size={80} className="text-gray-300 mb-6" />
      <Title className="text-4xl font-bold mb-4">404 - Page Not Found</Title>
      <Text c="dimmed" size="lg" mb="xl" className="max-w-md">
        The page you are looking for doesn't exist or you don't have permission to access it.
      </Text>
      <Group justify="center">
        <Button size="lg" variant="light" onClick={() => navigate(-1)}>
          Go Back
        </Button>
        <Button size="lg" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </Button>
      </Group>
    </Container>
  );
}
