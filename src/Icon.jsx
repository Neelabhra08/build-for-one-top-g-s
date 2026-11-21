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
  phone: (
    <>
      <rect x="6" y="2" width="8" height="16" rx="2" />
      <path d="M9 15h2" />
    </>
  ),
  pill: (
    <>
      <rect x="3" y="7" width="14" height="6" rx="3" transform="rotate(-35 10 10)" />
      <path d="M8 6.5l4 7" />
    </>
  ),
  bed: (
    <>
      <path d="M2 15V5M2 12h16v3M18 12v-2a3 3 0 0 0-3-3H9v5" />
      <circle cx="5.5" cy="9" r="1.5" />
    </>
  ),
  list: <path d="M7 5h10M7 10h10M7 15h10M3 5h.01M3 10h.01M3 15h.01" />,
  plus: <path d="M10 4v12M4 10h12" />,
  trash: <path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11" />,
  speaker: <path d="M3 8v4h3l4 3V5L6 8ZM13 7.5a3.5 3.5 0 0 1 0 5M15.5 5a7 7 0 0 1 0 10" />,
  keyboard: (
    <>
      <rect x="2" y="5" width="16" height="10" rx="2" />
      <path d="M5 8h.01M8 8h.01M11 8h.01M14 8h.01M6 12h8" />
    </>
  ),
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
