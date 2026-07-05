import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { GoogleAuthProvider } from '@/components/auth/GoogleAuthProvider';
import { store } from './store';
import { router } from './app/router';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <GoogleAuthProvider>
          <RouterProvider router={router} />
        </GoogleAuthProvider>
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </Provider>
  </StrictMode>
);
