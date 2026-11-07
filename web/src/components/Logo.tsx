export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="whale-gradient" x1="8" y1="8" x2="34" y2="34">
          <stop stopColor="#7c9cff" />
          <stop offset="1" stopColor="#4d6bfe" />
        </linearGradient>
      </defs>
      <path
        d="M7.5 23.2c0-7.4 5.9-13.2 14-13.2 4.3 0 7.6 1.3 9.9 3.4l4.4-2.1-1.2 5.4c1.3 2.1 2 4.4 2 6.6 0 7.4-6.3 12.9-15 12.9-8.2 0-14.1-5.4-14.1-13Z"
        fill="url(#whale-gradient)"
      />
      <path
        d="M10.5 14.2C8.2 11.6 5 10.8 2 11.9c2.3 1.8 3.5 3.9 3.7 6.1"
        fill="#4d6bfe"
      />
      <circle cx="26.2" cy="19.4" r="1.9" fill="#f8fafc" />
      <path
        d="M14.5 29.2c3.1 1.8 7 1.8 10.2 0"
        stroke="#e8edff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
