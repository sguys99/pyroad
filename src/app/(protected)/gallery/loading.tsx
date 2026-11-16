import { GalleryBanner } from '@/components/gallery/GalleryParts';

/** 갤러리 불러오는 중: 배너 + 빈 액자 자리 (움직이지 않는 자리표시, P11-07) */
export default function GalleryLoading() {
  return (
    <div
      className="mx-auto grid min-h-screen max-w-lg content-start gap-5 px-4 py-4 sm:py-6 md:max-w-6xl"
      aria-busy="true"
    >
      <div className="h-12" />
      <GalleryBanner />
      <p role="status" className="sr-only">
        작품을 걸고 있어요
      </p>
      <ul className="gl-wall" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i}>
            <span className="gl-card block rounded-xl bg-surface shadow-card">
              <span className="gl-frame" />
              <span className="mt-2 block h-4 w-2/3 rounded-full bg-surface-2" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
