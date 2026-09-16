import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <FileQuestion className="w-14 h-14 mx-auto mb-4 text-text-muted" strokeWidth={1.5} />
        <h1 className="text-2xl font-bold text-text-primary mb-2">Page not found</h1>
        <p className="text-text-secondary mb-6">The page you&apos;re looking for doesn&apos;t exist.</p>
        <a href="/feed" className="text-gold-300 hover:text-gold-400 font-medium">← Back to feed</a>
      </div>
    </div>
  );
}
