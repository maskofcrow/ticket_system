/** Esta Bilişim devre-izi logosu. `currentColor` alır (varsayılan beyaz). */
export function Logo({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="24" cy="20" r="8" />
      <path d="M33 20 H52 L60 28 H90" />
      <circle cx="46" cy="40" r="8" />
      <path d="M55 40 H90" />
      <circle cx="18" cy="54" r="8" />
      <path d="M27 54 H40 L48 62 H64 L72 54 H90" />
      <circle cx="34" cy="76" r="8" />
      <path d="M43 76 H66 L74 68 H90" />
    </svg>
  );
}
