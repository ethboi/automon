import Link from 'next/link';

export default function LocationNotFound() {
  return (
    <div className="page-container py-20">
      <div className="section-card text-center max-w-lg mx-auto">
        <div className="text-5xl mb-3">🧭</div>
        <h1 className="text-2xl font-black text-white mb-2">Unknown Location</h1>
        <p className="text-gray-400 mb-4">That location page does not exist.</p>
        <Link href="/" className="btn-primary">Return to World</Link>
      </div>
    </div>
  );
}
