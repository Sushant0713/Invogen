import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '@/api/client';
import { Loader } from '@/components/ui/Loader';
import { Button } from '@/components/ui/Button';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    api.get(`/auth/verify-email/${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  if (status === 'loading') return <Loader fullScreen />;

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="glass w-full max-w-md p-8 text-center">
        {status === 'success' ? (
          <>
            <h2 className="text-2xl font-bold text-green-600">Email Verified!</h2>
            <p className="mt-2 text-gray-600">Your account is now active.</p>
            <Link to="/admin/login"><Button className="mt-6">Sign In</Button></Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-red-600">Verification Failed</h2>
            <p className="mt-2 text-gray-600">The link may be invalid or expired.</p>
            <Link to="/"><Button variant="outline" className="mt-6">Go Home</Button></Link>
          </>
        )}
      </div>
    </div>
  );
}
