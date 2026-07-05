import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserRole, type AuthUser } from '@invogen/shared';
import api from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { setCredentials } from '@/store/slices/authSlice';
import { Loader } from '@/components/ui/Loader';
import { getLoginPath } from '@/config/navigation';
import { useRehydrateUserPreferences } from '@/lib/use-rehydrate-user-preferences';

interface MeResponse {
  user: AuthUser;
  subscriptionActive?: boolean;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles: UserRole[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const location = useLocation();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<{ data: MeResponse }>('/auth/me');
      return data.data;
    },
    enabled: isAuthenticated,
    staleTime: 0,
    retry: false,
  });

  useRehydrateUserPreferences(data?.user?.id ?? user?.id);

  useEffect(() => {
    if (data) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        dispatch(setCredentials({ user: data.user, accessToken: token }));
      }
    }
  }, [data, dispatch]);

  if (!isAuthenticated) {
    const loginPath = roles[0] ? getLoginPath(roles[0]) : '/';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (isError) {
    const loginPath = roles[0] ? getLoginPath(roles[0]) : '/';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (isLoading || isFetching || !data) {
    return <Loader fullScreen />;
  }

  if (!roles.includes(data.user.role)) {
    return <Navigate to="/403" replace />;
  }

  if (user && !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
