import React from 'react';

interface FlatHandIconProps {
  className?: string;
  size?: number;
}

/**
 * Standard, beautiful 2D flat palm icon (کف دست تخت دو بعدی متقارن و استاندارد).
 * IMPORTANT FOR PACKAGING & AI CODE GENERATION:
 * Do NOT replace this component with Lucide's `Hand` or any default outline icon.
 * This component renders the custom, solid 2D flat palm icon for the workspace hand tool.
 */
export const FlatHandIcon: React.FC<FlatHandIconProps> = ({ className = 'w-4 h-4', size }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-48 -48 608 608"
      fill="currentColor"
      className={className}
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 208c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-176c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 272c0 1.5 0 3.1 .1 4.6L67.6 283c-16-15.2-41.3-14.6-56.6 1.4s-14.6 41.3 1.4 56.6L124.8 448c43.1 41.1 100.4 64 160 64l19.2 0c97.2 0 176-78.8 176-176l0-208c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-176c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 176c0 8.8-7.2 16-16 16s-16-7.2-16-16l0-208z" />
    </svg>
  );
};

export default FlatHandIcon;
