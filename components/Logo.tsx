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
      {/* Wallet body */}
      <rect
        x="3"
        y="7"
        width="26"
        height="20"
        rx="3"
        className="fill-primary/15"
      />
      <rect
        x="3"
        y="7"
        width="26"
        height="20"
        rx="3"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Coin/symbol inside */}
      <circle
        cx="16"
        cy="17"
        r="4"
        className="stroke-primary"
        strokeWidth="2"
      />
      <path
        d="M16 15V17L17.5 18.5"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Wallet clasp */}
      <rect
        x="22"
        y="14"
        width="5"
        height="6"
        rx="1.5"
        className="stroke-primary"
        strokeWidth="2"
      />
      <circle
        cx="24.5"
        cy="17"
        r="1"
        className="fill-primary"
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
      <rect
        x="4"
        y="8"
        width="24"
        height="18"
        rx="2.5"
        className="fill-primary/12"
      />
      <rect
        x="4"
        y="8"
        width="24"
        height="18"
        rx="2.5"
        className="stroke-primary"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="17"
        r="3.5"
        className="stroke-primary"
        strokeWidth="2"
      />
      <rect
        x="21"
        y="14"
        width="5"
        height="6"
        rx="1.5"
        className="stroke-primary"
        strokeWidth="2"
      />
    </svg>
  );
}
