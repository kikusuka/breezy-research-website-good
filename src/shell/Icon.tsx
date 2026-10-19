import React from 'react';
export function Icon({ name, className = '', fill = false }: { name: string; className?: string; fill?: boolean }) {
  return <span aria-hidden="true" className={`material-symbols-outlined${fill ? ' fill' : ''} ${className}`.trim()}>{name}</span>;
}
