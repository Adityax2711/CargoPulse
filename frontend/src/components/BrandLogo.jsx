import React from 'react';

/**
 * Modern High-Tech Brand Mark & Typographic Lockup
 * Designed for high-precision telemetry, immutable custody, and parametric speed.
 */
export function BrandIcon({ className = "w-8 h-8", glow = true }) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {glow && (
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/30 via-indigo-500/20 to-purple-500/30 blur-md rounded-xl" />
      )}
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 drop-shadow-[0_2px_8px_rgba(6,182,212,0.3)]"
      >
        <defs>
          <linearGradient id="brand-grad-outer" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          <linearGradient id="brand-grad-inner" x1="12" y1="12" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient id="brand-grad-pulse" x1="14" y1="24" x2="34" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
        </defs>

        {/* Outer Angular Shield / Telemetry Node Frame */}
        <path
          d="M24 4L42 12V24C42 34 34 41.5 24 45C14 41.5 6 34 6 24V12L24 4Z"
          fill="#0B0F19"
          stroke="url(#brand-grad-outer)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Internal Isometric Facet / Cargo Geometry */}
        <path
          d="M24 9L37 15.5V23.5L24 17L11 23.5V15.5L24 9Z"
          fill="url(#brand-grad-inner)"
          fillOpacity="0.18"
          stroke="url(#brand-grad-inner)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Central Kinetic Telemetry Pulse (Impact & Wave Signal) */}
        <path
          d="M13 26L19 26L22 20L26 31L29 24L31 26L35 26"
          stroke="url(#brand-grad-pulse)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Precision Sensor Anchor Points */}
        <circle cx="24" cy="4" r="1.5" fill="#38BDF8" />
        <circle cx="22" cy="20" r="1.2" fill="#34D399" />
        <circle cx="26" cy="31" r="1.2" fill="#A855F7" />
      </svg>
    </div>
  );
}

export function BrandLockup({
  name = "CargoPulse",
  tagline = "LOGISTICS TELEMETRY & CLAIMS",
  size = "md",
  className = ""
}) {
  const sizeMap = {
    sm: { icon: "w-7 h-7", text: "text-base", sub: "text-[9px]" },
    md: { icon: "w-9 h-9", text: "text-lg", sub: "text-[10px]" },
    lg: { icon: "w-12 h-12", text: "text-2xl", sub: "text-xs" },
    xl: { icon: "w-16 h-16", text: "text-3xl", sub: "text-sm" }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center space-x-3 select-none ${className}`}>
      <BrandIcon className={currentSize.icon} />
      <div className="flex flex-col">
        <div className="flex items-baseline space-x-1.5 leading-none">
          <span className={`font-black tracking-tight text-white font-sans ${currentSize.text}`}>
            Cargo<span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">Pulse</span>
          </span>
          <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase tracking-widest">
            PRO
          </span>
        </div>
        {tagline && (
          <span className={`font-mono font-medium tracking-widest text-slate-400 uppercase mt-0.5 ${currentSize.sub}`}>
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}

export default BrandLockup;

