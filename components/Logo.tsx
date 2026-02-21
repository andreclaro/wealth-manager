"use client";

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = "", size = 24 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M16 4L25 7.5V13.5C25 19.1 21.5 24.3 16 27C10.5 24.3 7 19.1 7 13.5V7.5L16 4Z"
        className="fill-primary/12"
      />
      <path
        d="M16 4L25 7.5V13.5C25 19.1 21.5 24.3 16 27C10.5 24.3 7 19.1 7 13.5V7.5L16 4Z"
        className="stroke-primary"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M11 18.5L14.5 15L17 17.5L21.5 12.5"
        className="stroke-primary"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M21.5 12.5H19.2"
        className="stroke-primary"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M21.5 12.5V14.8"
        className="stroke-primary"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function LogoIcon({ className = "", size = 32 }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M16 4L25 7.5V13.5C25 19.1 21.5 24.3 16 27C10.5 24.3 7 19.1 7 13.5V7.5L16 4Z"
        className="fill-primary/12"
      />
      <path
        d="M16 4L25 7.5V13.5C25 19.1 21.5 24.3 16 27C10.5 24.3 7 19.1 7 13.5V7.5L16 4Z"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M11 18.5L14.5 15L17 17.5L21.5 12.5"
        className="stroke-primary"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M21.5 12.5H19.2"
        className="stroke-primary"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <path
        d="M21.5 12.5V14.8"
        className="stroke-primary"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}
