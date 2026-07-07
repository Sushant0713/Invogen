import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

const schema = z.object({ password: z.string().min(8) });

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ password: string }>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: { password: string }) => {
    if (!token) return;
    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, data);
      toast.success('Password reset successful');
      navigate('/admin/login');
    } catch {
      toast.error('Reset failed');
    } finally {
      setLoading(false);
    }
  };

  if (!token) return <div className="p-8 text-center">Invalid reset link</div>;

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="glass w-full max-w-md p-8">
        <h2 className="text-2xl font-bold">Reset Password</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Input label="New Password" fieldKind="password-new" {...register('password')} error={errors.password?.message as string} />
          <Button type="submit" className="w-full" loading={loading}>Reset Password</Button>
        </form>
        <p className="mt-4 text-center text-sm"><Link to="/admin/login" className="text-primary">Back to login</Link></p>
      </div>
    </div>
  );
}
