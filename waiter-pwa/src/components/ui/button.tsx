import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
          variant === 'default' && "bg-primary text-primary-foreground hover:bg-primary/90",
          variant === 'outline' && "border border-input bg-background hover:bg-accent",
          variant === 'ghost' && "hover:bg-accent hover:text-accent-foreground",
          size === 'sm' && "h-9 px-3 text-sm",
          size === 'md' && "h-10 px-4",
          size === 'lg' && "h-11 px-8",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
