import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { useIconAnimation, type AnimatedIcon } from "@/components/icons/animated";

type AnimatedButtonProps = ComponentProps<typeof Button> & { icon: AnimatedIcon };

/** A Button whose icon animates while the button is hovered or focused. */
export function AnimatedButton({ icon: Icon, children, ...props }: AnimatedButtonProps) {
  const { ref, triggers } = useIconAnimation();
  return (
    <Button {...props} {...triggers}>
      <Icon ref={ref} size={16} />
      {children}
    </Button>
  );
}
