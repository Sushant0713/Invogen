import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { UserRole, type AuthUser } from '@invogen/shared';
import api from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/useAppDispatch';
import { setCredentials, logout as logoutAction } from '@/store/slices/authSlice';
import { clearSession } from '@/lib/auth-session';
import { Loader } from '@/components/ui/Loader';
import { getLoginPath } from '@/config/navigation';
import { loginPath as buildLoginPath } from '@/lib/workspace-portal';
import { useRehydrateUserPreferences } from '@/lib/use-rehydrate-user-preferences';
import { useQueryClient } from '@tanstack/react-query';
import { MAINTENANCE_QUERY_KEY, type MaintenanceStatus } from '@/lib/maintenance-status-cache';

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
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAppSelector((s) => s.auth);
  const location = useLocation();
  const shouldLiveSync = roles.includes(UserRole.EMPLOYEE);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data } = await api.get<{ data: MeResponse }>('/auth/me');
      return data.data;
    },
    enabled: isAuthenticated,
    staleTime: shouldLiveSync ? 15_000 : 5 * 60_000,
    refetchOnWindowFocus: shouldLiveSync,
    refetchInterval: shouldLiveSync ? 30_000 : false,
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
    const maintenance = queryClient.getQueryData<MaintenanceStatus>(MAINTENANCE_QUERY_KEY);
    if (
      maintenance?.enabled &&
      (roles.includes(UserRole.ADMIN) || roles.includes(UserRole.EMPLOYEE))
    ) {
      return <Navigate to="/maintenance" replace />;
    }

    const loginPath = roles[0] ? getLoginPath(roles[0]) : '/';
    if (
      roles.includes(UserRole.ADMIN)
      && user?.role === UserRole.ADMIN
      && user.authProvider === 'local'
      && !user.isEmailVerified
    ) {
      clearSession();
      dispatch(logoutAction());
      const params = new URLSearchParams({ registered: '1', email: user.email });
      return <Navigate to={buildLoginPath('admin', Object.fromEntries(params.entries()))} replace />;
    }
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (isLoading || !data) {
    return <Loader fullScreen />;
  }

  if (
    roles.includes(UserRole.ADMIN)
    && data.user.role === UserRole.ADMIN
    && data.user.authProvider === 'local'
    && !data.user.isEmailVerified
  ) {
    clearSession();
    dispatch(logoutAction());
    const params = new URLSearchParams({ registered: '1', email: data.user.email });
    return <Navigate to={buildLoginPath('admin', Object.fromEntries(params.entries()))} replace />;
  }

  if (!roles.includes(data.user.role)) {
    return <Navigate to="/403" replace />;
  }

  if (user && !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
