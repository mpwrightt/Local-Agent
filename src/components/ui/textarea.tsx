import * as React from 'react'
import { cn } from '../../lib/cn'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[72px] resize-none rounded-lg border border-neutral-800 bg-neutral-950/60 p-3 text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-rose-500/60',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'


