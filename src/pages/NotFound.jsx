import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <h2 className="text-2xl font-semibold text-gray-900 mt-4">Page Not Found</h2>
      <p className="text-gray-500 mt-2">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-6">
        <Home className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
