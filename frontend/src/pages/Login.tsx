import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TextInput, 
  PasswordInput, 
  Button, 
  Paper, 
  Title, 
  Container, 
  Alert 
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { AlertCircle } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth-store';

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state: any) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      username: '',
      password: '',
    },
    validate: {
      username: (val: string) => (val ? null : 'Username is required'),
      password: (val: string) => (val ? null : 'Password is required'),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.login(values.username, values.password);
      setAuth(response.access_token, response.user);
      
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <Title ta="center" className="font-bold text-3xl mb-8">
        Welcome to IRMS
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        {error && (
          <Alert icon={<AlertCircle size={16} />} title="Error" color="red" mb="lg">
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput 
            label="Username" 
            placeholder="admin or inspector" 
            required 
            {...form.getInputProps('username')}
          />
          <PasswordInput 
            label="Password" 
            placeholder="Your password" 
            required 
            mt="md" 
            {...form.getInputProps('password')}
          />

          <Button fullWidth mt="xl" type="submit" loading={loading} size="md">
            Sign in
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
