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
  secondary: 'bg-brand-soft text-brand-strong hover:bg-[#ffe8d3]',
  outline: 'border border-line bg-white text-ink hover:border-brand/40 hover:text-brand',
  ghost: 'text-ink-soft hover:bg-surface hover:text-ink',
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
