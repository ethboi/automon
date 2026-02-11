import Link from 'next/link';
import { notFound } from 'next/navigation';
import LocationLivePanel from './LocationLivePanel';
import { LOCATION_PAGES } from '@/lib/location-pages';

export default function LocationPage({ params }: { params: { slug: string } }) {
  const location = LOCATION_PAGES[params.slug as keyof typeof LOCATION_PAGES];
  if (!location) return notFound();

  return (
    <div className="page-container page-transition">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl sm:text-4xl">{location.icon}</span>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">{location.name}</h1>
            <p className="text-sm sm:text-base text-gray-300">{location.tagline}</p>
          </div>
        </div>
      </div>

      <section className={`section-card mb-6 border border-white/10 bg-gradient-to-br ${location.accent}`}>
        <p className="text-gray-100 text-sm sm:text-base leading-relaxed mb-4">{location.description}</p>
        <div className="grid sm:grid-cols-3 gap-2 mb-4">
          {location.highlights.map((item) => (
            <div key={item} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-100">
              {item}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/" className="btn-secondary">Back to World</Link>
          {location.primaryHref && location.primaryLabel && (
            <Link href={location.primaryHref} className="btn-primary">{location.primaryLabel}</Link>
          )}
        </div>
      </section>

      <LocationLivePanel worldLabel={location.worldLabel} />
    </div>
  );
}
