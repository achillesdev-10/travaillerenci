interface CVIllustrationProps {
  className?: string;
}

export default function CVIllustration({ className }: CVIllustrationProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="120" height="120" rx="26" fill="#111827" />
      <circle cx="102" cy="16" r="30" fill="#f97316" opacity="0.22" />
      <circle cx="12" cy="108" r="34" fill="#f97316" opacity="0.14" />
      <circle cx="60" cy="47" r="19" fill="#f4c7a1" />
      <path
        d="M41 47c0-13 8-22 19-22s19 9 19 22c-3-3-6-5-10-6-3 2-6 3-9 3s-6-1-9-3c-4 1-7 3-10 6Z"
        fill="#1f2937"
      />
      <path d="M27 114c3-25 17-39 33-39s30 14 33 39" fill="#f97316" />
      <path
        d="m46 79 14 15 14-15c-4-2-9-3-14-3s-10 1-14 3Z"
        fill="#ffffff"
        opacity="0.96"
      />
      <path d="M57 96h6l2 10H55l2-10Z" fill="#111827" />
      <path
        d="M51 43h4M65 43h4"
        stroke="#111827"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M55 56c2 2 8 2 10 0"
        stroke="#111827"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
