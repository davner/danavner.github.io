import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// A badge is a readout with a border round it, so the mono label comes from the
// `readout` utility rather than from a second spelling of its five declarations.
//
// No `whitespace-nowrap`, which is what lets `w-fit` mean what it says.
// `fit-content` is "as wide as the text, but no wider than the room available",
// and holding the text on one line makes those two the same number, so a chip
// too long for its column pushes the column instead of fitting inside it. A
// flex item still takes a new line before it shrinks and only shrinks alone on
// one, so a chip wraps where it could not have fitted anyway and nowhere else.
const badgeVariants = cva(
  "readout inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden border px-2 py-0.5 transition-[color,box-shadow] [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground [a&]:hover:bg-destructive/90",
        outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // Site additions: the two accents, as hairline-outlined chips.
        ember: "border-ember/50 text-ember",
        ion: "border-ion/50 text-ion",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
