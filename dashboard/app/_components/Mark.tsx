export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`shrink-0 ${className}`} aria-hidden>
      <path
        d="M3.2 17.2A10 10 0 0 1 20.8 17.2"
        stroke="currentColor"
        strokeWidth="1.3"
        opacity="0.5"
      />
      <path d="M4.6 12.6 6.2 13.4M12 4.4V6.2M19.4 12.6 17.8 13.4" stroke="currentColor" strokeWidth="1.3" />
      <path d="M12 17 16.4 9.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.9" fill="currentColor" />
    </svg>
  );
}
