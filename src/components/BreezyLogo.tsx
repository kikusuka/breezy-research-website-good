import React from 'react';

interface BreezyLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

/** Use the single approved brand asset everywhere; don't recreate the mark in SVG/CSS. */
export const BreezyLogo: React.FC<BreezyLogoProps> = ({
  className = '',
  size = 32,
  showWordmark = false,
  wordmarkClassName = '',
}) => (
  <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
    <img
      src="/breezy1.png"
      alt="Breezy"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      draggable={false}
    />
    {showWordmark && (
      <span className={`font-semibold tracking-tight text-on-surface ${wordmarkClassName}`}>Breezy</span>
    )}
  </div>
);
