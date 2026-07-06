import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TextInput, 
  PasswordInput, 
  Button, 
  Paper, 
  Title, 
  Text,
  Alert 
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { AlertCircle } from 'lucide-react';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/auth-store';
import { Capacitor } from '@capacitor/core';

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state: any) => state.setAuth);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const isNative = Capacitor.isNativePlatform();

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
    <div className="min-h-screen flex w-full bg-gray-50 dark:bg-[#1a1b1e]">
      {/* Left Side - Branding/Visuals */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-12 items-center justify-center relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>
        
        <div className="z-10 text-center text-white max-w-lg flex flex-col items-center">
          <div className="bg-white dark:bg-[#25262b] p-4 rounded-2xl shadow-2xl mb-8 transform transition-transform hover:scale-105 duration-300">
            <img src="/logo.png" alt="IRMS Logo" className="w-32 h-auto rounded-lg" />
          </div>
          <h1 className="text-4xl font-bold mb-4 tracking-tight">Inspection & Reporting Management System</h1>
          <p className="text-blue-200 text-lg">
            Streamline your workflow, manage inspections efficiently, and generate comprehensive reports with ease.
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 sm:p-12 relative">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
             <img src="/logo.png" alt="IRMS Logo" className="w-24 h-auto rounded-xl shadow-lg" />
          </div>

          <Title order={2} className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2" ta="center">
            Welcome Back
          </Title>
          <Text c="dimmed" size="sm" ta="center" mb={30}>
            Please sign in to your account to continue
          </Text>

          <Paper withBorder shadow="xl" p={40} radius="lg" className="bg-white/80 dark:bg-[#25262b]/80 backdrop-blur-sm">
            {error && (
              <Alert icon={<AlertCircle size={16} />} title="Error" color="red" mb="lg" radius="md">
                {error}
              </Alert>
            )}

            <form onSubmit={form.onSubmit(handleSubmit)} className="space-y-4">
              <TextInput 
                label="Username" 
                placeholder="admin or inspector" 
                required 
                size="md"
                radius="md"
                {...form.getInputProps('username')}
              />
              <PasswordInput 
                label="Password" 
                placeholder="Your password" 
                required 
                size="md"
                radius="md"
                {...form.getInputProps('password')}
              />

              <Button 
                fullWidth 
                mt="xl" 
                type="submit" 
                loading={loading} 
                size="md" 
                radius="md"
                className="bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Sign in
              </Button>
            </form>
          </Paper>

          {/* Download App Section */}
          {!isNative && (
            <div className="mt-12 text-center flex flex-col items-center">
              <div className="relative group">
                {/* Animated glow effect behind the button */}
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-green-500 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                
                <a 
                  href="/irms.apk" 
                  download
                  className="relative flex items-center justify-center gap-4 px-8 py-3.5 bg-black text-white rounded-2xl transition-all duration-300 w-full min-w-[240px] border border-white/10 overflow-hidden shadow-2xl"
                >
                  {/* Internal Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Android Icon (SVG) */}
                  <svg className="w-8 h-8 text-[#3DDC84] drop-shadow-[0_0_8px_rgba(61,220,132,0.4)] group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_rgba(61,220,132,0.8)] transition-all duration-300" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0004.5511-.4482.9997-.9993.9997zm-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997zm11.4045-6.02l1.9973-3.4592c.1158-.201.0469-.4567-.1545-.5725-.201-.1158-.4567-.0465-.5725.1545L17.11 8.974c-1.4682-.6761-3.1818-1.0558-5.01-1.0558-1.8282 0-3.5418.3797-5.01 1.0558L5.0487 5.4442c-.1158-.201-.3715-.2703-.5725-.1545-.2014.1158-.2703.3715-.1545.5725l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.3195-9.4396z" />
                  </svg>
                  
                  <div className="flex flex-col items-start z-10 text-left">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400 font-bold leading-tight group-hover:text-gray-200 transition-colors">Download for</span>
                    <span className="text-xl font-black tracking-tight leading-none mt-1">Android</span>
                  </div>
                </a>
              </div>
              <Text c="dimmed" size="xs" mt="lg" className="font-medium tracking-wide">
                Install the native app for better offline sync
              </Text>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
