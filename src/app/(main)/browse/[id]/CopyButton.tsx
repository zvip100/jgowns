'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { cn } from '@/lib/utils';

type CopyButtonProps = {
  value: string;
  label: string;
  className?: string;
};

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error('Copy to clipboard failed:', error);
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <button
      type='button'
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : label}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center text-[#a08a72] transition-colors hover:text-[#5a4537]',
        copied && 'text-[#2d7a4f]',
        className,
      )}
    >
      <Icon className='size-4' aria-hidden='true' />
    </button>
  );
}
