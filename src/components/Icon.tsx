import type { SVGProps } from "react";

/**
 * One consistent icon family: 24px grid, 1.75 stroke, round joins.
 * Kept in-house so the app doesn't carry an icon library for 20 glyphs.
 */
const PATHS = {
  cook: (
    <>
      <path d="M4 11h16v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M2.5 11h19" />
      <path d="M9.5 7.5c0-1 1-1.5 1-2.5M13.5 7.5c0-1 1-1.5 1-2.5" />
    </>
  ),
  pantry: (
    <>
      <rect x="6" y="7.5" width="12" height="13" rx="2.5" />
      <path d="M7.5 3.5h9v4h-9z" />
      <path d="M9.5 12.5h5" />
    </>
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  battles: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 3.6M16 6h2.5a2.5 2.5 0 0 1-2.6 3.6" />
      <path d="M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z" />
    </>
  ),
  neighbors: (
    <>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <circle cx="16.75" cy="9" r="2.5" />
      <path d="M15.5 14.1a4.5 4.5 0 0 1 5 5.4" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  mic: (
    <>
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" />
    </>
  ),
  chat: <path d="M4.5 5.5h15v10h-9l-4.5 4v-4h-1.5z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  back: <path d="m14.5 6-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 10V6.5a3 3 0 0 1 6 0V10" />
    </>
  ),
  barcode: <path d="M4 5v14M7.5 5v14M10 5v14M13.5 5v14M16 5v14M20 5v14" />,
  camera: (
    <>
      <path d="M4 8.5h3l2-3h6l2 3h3V19H4z" />
      <circle cx="12" cy="13.5" r="3.25" />
    </>
  ),
  swap: <path d="M7 8h12l-3.5-3.5M17 16H5l3.5 3.5" />,
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  send: <path d="M4.5 12 20 4.5 14 20l-2.5-6z" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  hourglass: <path d="M7 3.5h10M7 20.5h10M8 3.5c0 5 8 5 8 8.5s-8 3.5-8 8.5M16 3.5c0 5-8 5-8 8.5s8 3.5 8 8.5" />,
};

export type IconName = keyof typeof PATHS;

type Props = { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>;

export function Icon({ name, size = 22, strokeWidth = 1.75, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
