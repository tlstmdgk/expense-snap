import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-500">
      <p>Page not found.</p>
      <Link to="/" className="text-blue-600 hover:underline">
        Go home
      </Link>
    </div>
  );
}
