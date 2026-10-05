import { useRef, type ForwardRefExoticComponent, type RefAttributes } from "react";

// Icons in this folder come from lucide-animated (shadcn registry, built on `motion`).
// Each one exposes start/stop handles; driving them from the parent lets a whole button or
// menu item trigger the animation, not just the 16px icon under the pointer.

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export type AnimatedIcon = ForwardRefExoticComponent<{ size?: number; className?: string } & RefAttributes<AnimatedIconHandle>>;

/** Wires an animated icon to its parent's hover and keyboard focus. Spread `triggers` on the parent. */
export function useIconAnimation() {
  const ref = useRef<AnimatedIconHandle>(null);
  const start = () => ref.current?.startAnimation();
  const stop = () => ref.current?.stopAnimation();
  return { ref, triggers: { onMouseEnter: start, onMouseLeave: stop, onFocus: start, onBlur: stop } };
}
