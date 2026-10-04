export function Mark() {
  return (
    <svg viewBox="0 0 36 36" width="33" height="33" aria-hidden="true">
      <path
        d="M9 6h18v23H9z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5 10h18v23H5z"
        fill="var(--canvas)"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M13 3h18v23H13z"
        fill="var(--paper)"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle
        cx="22"
        cy="14"
        r="5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M22 9v10" stroke="currentColor" />
    </svg>
  );
}
