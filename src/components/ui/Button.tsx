import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

type BaseProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonProps = BaseProps &
  Omit<ComponentProps<'button'>, 'children' | 'className'> & {
    href?: undefined;
  };

type LinkProps = BaseProps &
  Omit<ComponentProps<typeof Link>, 'children' | 'className' | 'href'> & {
    href: string;
  };

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white shadow-card hover:bg-brand-strong',
  secondary:
    'bg-brand-soft text-brand-strong hover:bg-[#ffe8d3] dark:bg-brand/15 dark:text-brand-accent dark:hover:bg-brand/25',
  outline:
    'border border-line bg-white text-black hover:border-brand/40 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-brand-accent/50 dark:hover:text-brand-accent',
  ghost:
    'text-black hover:bg-surface hover:text-brand dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-brand-accent',
  danger: 'bg-danger text-white shadow-card hover:bg-red-700',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-3.5 text-sm',
  md: 'min-h-11 px-5 text-sm',
  lg: 'min-h-12 px-6 text-base',
};

const STYLE_KEYS = ['variant', 'size', 'fullWidth', 'className', 'children'] as const;

function cleanProps(props: Record<string, unknown>, omitted: readonly string[]) {
  const next = { ...props };
  for (const key of omitted) delete next[key];
  return next;
}

export default function Button(props: ButtonProps | LinkProps) {
  const { variant = 'primary', size = 'md', fullWidth = false, className, children } = props;
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );

  if ('href' in props && props.href) {
    const linkProps = cleanProps(props, [...STYLE_KEYS, 'href']) as Omit<
      LinkProps,
      keyof BaseProps | 'href'
    >;

    return (
      <Link href={props.href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = cleanProps(props, [...STYLE_KEYS, 'href']) as Omit<
    ButtonProps,
    keyof BaseProps | 'href'
  >;

  return (
    <button type="button" className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
