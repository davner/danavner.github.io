import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * `cursor-pointer` is a deliberate departure from upstream shadcn: Tailwind v4's
 * preflight sets `button { cursor: default }` and upstream never puts it back,
 * so every button on the site showed an arrow rather than a finger. Disabled
 * buttons are unaffected - `disabled:pointer-events-none` stops the cursor
 * resolving against them at all.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        // Any outline button: on hover the whole thing goes ember and picks up
        // a faint ember wash, so it reads as a target rather than lighting up
        // only its edges.
        //
        // The wash is 5% and not more. Ember on `--background` is 5.32:1 in the
        // light theme, so there is only 0.82 of headroom over the 4.5:1 that
        // 1.4.3 asks, and an ember wash spends it: at 10% the label measured
        // 4.32:1 from painted pixels on every control that uses this pattern.
        // 5% measures 4.77:1, 4.72 at its worst pixel. Anything darker fails
        // the light theme again.
        outline:
          "border border-border bg-background transition-colors hover:border-ember hover:bg-ember/5 hover:text-ember",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
