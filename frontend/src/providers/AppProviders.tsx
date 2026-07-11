import React, { useEffect } from 'react';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useAppStore } from '../store/app-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const { fontFamily } = useAppStore();

  useEffect(() => {
    document.documentElement.style.setProperty('--app-font-family', fontFamily);
  }, [fontFamily]);

  const theme = createTheme({
    primaryColor: 'blue',
    fontFamily: `${fontFamily}, sans-serif`,
    defaultRadius: 'md',
    components: {
      Button: {
        defaultProps: {
          size: 'md',
        },
      },
      TextInput: {
        defaultProps: {
          size: 'md',
        },
      },
      Select: {
        defaultProps: {
          size: 'md',
        },
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <Notifications position="top-right" zIndex={1000} />
        <ModalsProvider>
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </ModalsProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
