import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center p-4">
      <div>
        <p className="text-7xl mb-4">404</p>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/dashboard" className="btn-primary">← Back to Dashboard</Link>
      </div>
    </div>
  );
}
