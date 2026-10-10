import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
const variants = cva('inline-flex items-center justify-center rounded-lg font-semibold focus-visible:outline-2 disabled:opacity-50', { variants: { variant: { default: 'bg-teal-800 text-white', outline: 'border border-slate-400 bg-white text-slate-900' } }, defaultVariants: { variant: 'default' } });
export function Button({ asChild = false, className, variant, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants> & {
    asChild?: boolean;
}) { const Comp = asChild ? Slot : 'button'; return <Comp className={twMerge(clsx(variants({ variant }), className))} {...props}/>; }
