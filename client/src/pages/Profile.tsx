import { Card } from '@/components/ui/Card';
import { useAppSelector } from '@/hooks/useAppDispatch';
import { Badge } from '@/components/ui/Badge';

export default function Profile() {
  const user = useAppSelector((s) => s.auth.user);

  return (
    <div className="max-w-2xl">
      <Card>
        <h2 className="text-xl font-bold mb-6">Profile</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary-100 flex items-center justify-center text-2xl font-bold text-primary">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{user?.firstName} {user?.lastName}</h3>
              <p className="text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <Badge className="mt-1">{user?.role?.replace('_', ' ')}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant="success" className="mt-1">{user?.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Email Verified</p>
              <Badge variant={user?.isEmailVerified ? 'success' : 'warning'} className="mt-1">
                {user?.isEmailVerified ? 'Verified' : 'Pending'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
