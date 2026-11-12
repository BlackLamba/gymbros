import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-2xl font-semibold transition-[transform,background-color,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-95',
  secondary: 'border border-border bg-surface-2 text-fg hover:brightness-95 dark:hover:brightness-110',
  ghost: 'text-fg hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-95',
}

const sizes: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm rounded-xl',
  md: 'h-12 px-5 text-[15px]',
  lg: 'h-14 px-6 text-base',
  icon: 'size-11 rounded-xl',
}

export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className)
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...props} />
}
