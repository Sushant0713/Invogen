import type { ReactElement } from 'react';
import { getIconCatalogEntry } from './icon-components';

type GlyphProps = { color: string; soft: string; size: number };

/** Classic call handset (not a mobile device). */
function GlyphPhone({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.2 3.4c.9-.9 2.4-.9 3.3 0l1.4 1.4c.8.8.9 2.1.2 3l-.9 1.2c-.3.4-.2 1 .2 1.3 1.2.9 2.5 2.1 3.5 3.4.3.4.9.5 1.3.2l1.2-.9c.9-.7 2.2-.6 3 .2l1.4 1.4c.9.9.9 2.4 0 3.3l-.9 1c-.8.8-1.9 1.2-3 1-3.1-.5-6.3-2.6-9-5.3-2.7-2.7-4.8-5.9-5.3-9-.2-1.1.2-2.2 1-3l1-.9Z"
        fill={soft}
      />
      <path
        d="M6.6 4c.6-.6 1.6-.6 2.2 0l1.3 1.3c.5.5.6 1.4.1 2l-.9 1.2c-.5.6-.4 1.5.3 1.9 1.4 1 2.8 2.3 3.9 3.7.5.6 1.3.7 1.9.3l1.2-.9c.6-.5 1.5-.4 2 .1l1.3 1.3c.6.6.6 1.6 0 2.2l-.8.9c-.6.6-1.4.9-2.2.7-2.8-.5-5.7-2.4-8.2-4.9S4.4 9.1 4 6.3c-.2-.8.1-1.6.7-2.2l.9-.8Z"
        fill={color}
      />
      <path
        d="M15.2 5.2c1.6.3 3 1.4 3.8 2.9M14.4 3.2c2.5.5 4.6 2.2 5.8 4.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}

function GlyphMobile({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="2" width="10" height="20" rx="2.8" fill={soft} />
      <rect x="8.2" y="4" width="7.6" height="13.5" rx="1.4" fill={color} />
      <rect x="10.2" y="18.6" width="3.6" height="1.4" rx="0.7" fill={color} opacity="0.7" />
    </svg>
  );
}

function GlyphEmail({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill={soft} />
      <path d="M3.5 7.2 12 13.2 20.5 7.2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17.5 9.8 12.2M20 17.5 14.2 12.2" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}

function GlyphAt({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill={soft} />
      <circle cx="12" cy="12" r="4.2" stroke={color} strokeWidth="1.9" />
      <path d="M16.2 12v1.1a2.4 2.4 0 0 0 4.3 1.4" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.55" fill={color} />
    </svg>
  );
}

function GlyphAddress({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.8 12 21 12 21Z"
        fill={soft}
      />
      <path
        d="M12 20.2s5.7-4.6 5.7-9.4A5.7 5.7 0 0 0 6.3 10.8c0 4.8 5.7 9.4 5.7 9.4Z"
        fill={color}
        opacity="0.9"
      />
      <circle cx="12" cy="10.6" r="2.35" fill="#fff" />
    </svg>
  );
}

function GlyphPerson({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4.2" fill={soft} />
      <circle cx="12" cy="8" r="3.2" fill={color} />
      <path d="M4.5 20.5c1.2-4.2 3.8-6 7.5-6s6.3 1.8 7.5 6" fill={soft} />
      <path d="M5.4 20.2c1.1-3.6 3.4-5.1 6.6-5.1s5.5 1.5 6.6 5.1" fill={color} opacity="0.9" />
    </svg>
  );
}

function GlyphBuilding({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="3.5" width="11" height="17" rx="1.6" fill={soft} />
      <rect x="5.2" y="5" width="8.6" height="14.2" rx="1" fill={color} opacity="0.88" />
      <rect x="14" y="9" width="6" height="11.5" rx="1.2" fill={soft} />
      <rect x="15" y="10.2" width="4" height="9" rx="0.8" fill={color} opacity="0.7" />
      <rect x="7" y="7" width="1.8" height="1.8" rx="0.35" fill="#fff" />
      <rect x="10.2" y="7" width="1.8" height="1.8" rx="0.35" fill="#fff" />
      <rect x="7" y="10.2" width="1.8" height="1.8" rx="0.35" fill="#fff" />
      <rect x="10.2" y="10.2" width="1.8" height="1.8" rx="0.35" fill="#fff" />
      <rect x="8.4" y="15.5" width="2.8" height="3.7" rx="0.4" fill="#fff" />
    </svg>
  );
}

function GlyphBank({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.5 9.5 12 4.5 20.5 9.5Z" fill={soft} />
      <path d="M4.2 9.3 12 4.9l7.8 4.4" fill={color} opacity="0.9" />
      <rect x="5" y="10.2" width="2.2" height="7" rx="0.5" fill={soft} />
      <rect x="9.4" y="10.2" width="2.2" height="7" rx="0.5" fill={color} opacity="0.85" />
      <rect x="13.8" y="10.2" width="2.2" height="7" rx="0.5" fill={soft} />
      <rect x="18.2" y="10.2" width="1.8" height="7" rx="0.5" fill={color} opacity="0.65" />
      <rect x="3.2" y="17.5" width="17.6" height="2.4" rx="0.7" fill={color} />
    </svg>
  );
}

function GlyphCard({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2.4" fill={soft} />
      <rect x="3.5" y="6.5" width="17" height="11" rx="1.8" fill={color} opacity="0.9" />
      <rect x="3.5" y="9.2" width="17" height="2.4" fill="#000" opacity="0.22" />
      <rect x="5.2" y="14" width="5.2" height="1.5" rx="0.5" fill="#fff" opacity="0.9" />
      <rect x="14.5" y="13.7" width="4.2" height="2.1" rx="0.5" fill="#fff" opacity="0.55" />
    </svg>
  );
}

function GlyphWallet({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="13.5" rx="2.4" fill={soft} />
      <rect x="4" y="7.2" width="16" height="11" rx="1.8" fill={color} opacity="0.88" />
      <rect x="13.5" y="11" width="6.5" height="4.2" rx="1.2" fill={soft} />
      <circle cx="16.4" cy="13.1" r="1.15" fill={color} />
      <rect x="5.5" y="4.2" width="10" height="3.2" rx="1" fill={color} opacity="0.55" />
    </svg>
  );
}

function GlyphGst({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="4" width="17" height="16" rx="2.4" fill={soft} />
      <rect x="5" y="5.5" width="14" height="13" rx="1.6" fill={color} opacity="0.9" />
      <text
        x="12"
        y="14.2"
        textAnchor="middle"
        fill="#fff"
        fontSize="7.5"
        fontWeight="700"
        fontFamily="system-ui,Segoe UI,sans-serif"
      >
        GST
      </text>
    </svg>
  );
}

function GlyphPan({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="14" rx="2.2" fill={soft} />
      <rect x="4.6" y="6.2" width="14.8" height="11.6" rx="1.6" fill={color} opacity="0.9" />
      <circle cx="9" cy="11" r="2.1" fill="#fff" />
      <path d="M5.8 16.5c.7-1.8 2-2.7 3.2-2.7s2.5.9 3.2 2.7" fill="#fff" opacity="0.9" />
      <rect x="13.2" y="9.2" width="5" height="1.3" rx="0.5" fill="#fff" opacity="0.85" />
      <rect x="13.2" y="11.8" width="4" height="1.1" rx="0.5" fill="#fff" opacity="0.55" />
      <rect x="13.2" y="14.2" width="4.6" height="1.1" rx="0.5" fill="#fff" opacity="0.4" />
    </svg>
  );
}

function GlyphCalendar({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="15" rx="2.4" fill={soft} />
      <rect x="4.5" y="8.5" width="15" height="10.5" rx="1.6" fill={color} opacity="0.9" />
      <rect x="3.5" y="5" width="17" height="4" rx="2.2" fill={color} />
      <rect x="7.2" y="3.2" width="1.8" height="3.2" rx="0.7" fill={soft} />
      <rect x="15" y="3.2" width="1.8" height="3.2" rx="0.7" fill={soft} />
      <rect x="7" y="11.2" width="2.2" height="2.2" rx="0.45" fill="#fff" />
      <rect x="10.9" y="11.2" width="2.2" height="2.2" rx="0.45" fill="#fff" opacity="0.75" />
      <rect x="14.8" y="11.2" width="2.2" height="2.2" rx="0.45" fill="#fff" opacity="0.5" />
      <rect x="7" y="14.6" width="2.2" height="2.2" rx="0.45" fill="#fff" opacity="0.7" />
      <rect x="10.9" y="14.6" width="2.2" height="2.2" rx="0.45" fill="#fff" />
    </svg>
  );
}

function GlyphGlobe({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill={soft} />
      <circle cx="12" cy="12" r="7.4" fill={color} opacity="0.88" />
      <ellipse cx="12" cy="12" rx="3.2" ry="7.4" stroke="#fff" strokeWidth="1.4" opacity="0.85" />
      <path d="M4.8 12h14.4M5.6 8.2h12.8M5.6 15.8h12.8" stroke="#fff" strokeWidth="1.2" opacity="0.75" />
    </svg>
  );
}

function GlyphUpi({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.4" fill={soft} />
      <rect x="5" y="5" width="6.2" height="6.2" rx="1" fill={color} />
      <rect x="12.8" y="5" width="6.2" height="6.2" rx="1" fill={color} opacity="0.7" />
      <rect x="5" y="12.8" width="6.2" height="6.2" rx="1" fill={color} opacity="0.7" />
      <rect x="13.5" y="13.5" width="2.2" height="2.2" rx="0.4" fill={color} />
      <rect x="16.5" y="13.5" width="2.2" height="2.2" rx="0.4" fill={color} opacity="0.55" />
      <rect x="13.5" y="16.5" width="2.2" height="2.2" rx="0.4" fill={color} opacity="0.55" />
      <rect x="16.5" y="16.5" width="2.2" height="2.2" rx="0.4" fill={color} />
    </svg>
  );
}

function GlyphVerified({ color, soft, size }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.8 14.4 4l2.6-.2.9 2.4 2.3 1.2-.5 2.6 1.6 2.1-1.6 2.1.5 2.6-2.3 1.2-.9 2.4-2.6-.2L12 21.2 9.6 20l-2.6.2-.9-2.4-2.3-1.2.5-2.6L2.7 12l1.6-2.1-.5-2.6 2.3-1.2.9-2.4 2.6.2L12 2.8Z"
        fill={soft}
      />
      <path
        d="M12 4 14 5l2.2-.15.75 2 1.95 1-.4 2.2 1.35 1.75-1.35 1.75.4 2.2-1.95 1-.75 2L14 19l-2 1-2-1-2.2.15-.75-2-1.95-1 .4-2.2L5.4 12l1.35-1.75-.4-2.2 1.95-1 .75-2L10 5l2-1Z"
        fill={color}
      />
      <path
        d="M8.2 12.1 10.6 14.5 15.8 9.2"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const GLYPHS: Record<string, (p: GlyphProps) => ReactElement> = {
  phone: GlyphPhone,
  mobile: GlyphMobile,
  email: GlyphEmail,
  at: GlyphAt,
  address: GlyphAddress,
  person: GlyphPerson,
  building: GlyphBuilding,
  bank: GlyphBank,
  card: GlyphCard,
  wallet: GlyphWallet,
  gst: GlyphGst,
  pan: GlyphPan,
  calendar: GlyphCalendar,
  globe: GlyphGlobe,
  upi: GlyphUpi,
  verified: GlyphVerified,
};

export interface LibraryIconTileProps {
  iconKey?: string | null;
  accent?: string;
  accentSoft?: string;
  variant?: 'soft' | 'solid';
  /** Outer box size in px (square). */
  size: number;
  className?: string;
}

/** Soft/solid accent tile used in the asset library and on the canvas. */
export function LibraryIconTile({
  iconKey,
  accent,
  accentSoft,
  variant = 'soft',
  size,
  className,
}: LibraryIconTileProps) {
  const entry = getIconCatalogEntry(iconKey ?? undefined);
  const resolvedAccent = accent ?? entry?.accent ?? '#0F766E';
  const resolvedSoft = accentSoft ?? entry?.accentSoft ?? '#CCFBF1';
  const key = entry?.iconKey ?? iconKey ?? 'phone';
  const Glyph = GLYPHS[key] ?? GlyphPhone;
  const radius = Math.max(6, Math.round(size * 0.22));
  const glyphSize = Math.max(12, Math.round(size * 0.58));
  const solid = variant === 'solid';

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: solid
          ? `linear-gradient(145deg, ${resolvedAccent} 0%, ${resolvedAccent}cc 100%)`
          : `linear-gradient(145deg, ${resolvedSoft} 0%, #ffffff 72%)`,
        boxShadow: solid
          ? `0 6px 16px ${resolvedAccent}33, inset 0 1px 0 rgba(255,255,255,0.25)`
          : `0 1px 0 rgba(255,255,255,0.9) inset, 0 4px 14px ${resolvedAccent}22, 0 0 0 1px ${resolvedAccent}22`,
      }}
    >
      <Glyph
        color={solid ? '#ffffff' : resolvedAccent}
        soft={solid ? 'rgba(255,255,255,0.28)' : `${resolvedAccent}33`}
        size={glyphSize}
      />
    </div>
  );
}
