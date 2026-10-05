import { useLayoutEffect, useRef } from "react";

type Key = string | number;

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Slides list items from their old position to their new one when the order changes
 * (the FLIP technique). Only `transform` is animated, so it runs on the compositor and costs
 * nothing per frame on the main thread. Positions are read with `offsetTop`, which ignores
 * page scrolling. Usage: `const flip = useFlipAnimation(keys)` then `ref={flip(key)}` per item.
 */
export function useFlipAnimation<E extends HTMLElement>(orderedKeys: readonly Key[]) {
  const nodes = useRef(new Map<Key, E>());
  const lastTops = useRef(new Map<Key, number>());
  const order = orderedKeys.join("\u0000");

  useLayoutEffect(() => {
    const animate = !prefersReducedMotion();
    for (const [key, node] of nodes.current) {
      const top = node.offsetTop;
      const previous = lastTops.current.get(key);
      if (animate && previous !== undefined && previous !== top) {
        node.animate([{ transform: `translateY(${previous - top}px)` }, { transform: "translateY(0)" }], {
          duration: 450,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
      lastTops.current.set(key, top);
    }
  }, [order]);

  return (key: Key) => (node: E | null) => {
    if (node) nodes.current.set(key, node);
    else nodes.current.delete(key);
  };
}
