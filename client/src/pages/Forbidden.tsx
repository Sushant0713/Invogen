import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function Forbidden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-red-500">403</h1>
      <p className="mt-2 text-gray-600">Access denied</p>
      <Link to="/"><Button className="mt-6">Go Home</Button></Link>
    </div>
  );
}
