const PATHS = {
  drop: <path d="M10 2C10 2 4 9 4 13a6 6 0 0 0 12 0C16 9 10 2 10 2Z" />,
  door: (
    <>
      <path d="M5 2h10v16H5Z" />
      <circle cx="12" cy="10" r="1" fill="currentColor" />
    </>
  ),
  bolt: <path d="M11 2 4 11h5l-1 7 7-9h-5Z" />,
  alert: (
    <>
      <path d="M10 2 18 17H2Z" />
      <path d="M10 8v4" />
    </>
  ),
  check: <path d="M4 10l4 4 8-8" />,
  cross: <path d="M5 5l10 10M15 5 5 15" />,
  hand: <path d="M7 10V4a1.5 1.5 0 0 1 3 0v5M10 9V3a1.5 1.5 0 0 1 3 0v6M13 9V5a1.5 1.5 0 0 1 3 0v6c0 4-3 7-6 7s-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.6-1.5L7 11" />,
  heart: <path d="M10 17s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 17 8c0 4.5-7 9-7 9Z" />,
  repeat: <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3h3" />,
};

export default function Icon({ name, size = 20 }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] ?? null}
    </svg>
  );
}
