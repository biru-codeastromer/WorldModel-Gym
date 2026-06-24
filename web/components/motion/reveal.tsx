"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { createContext, useContext } from "react";

/**
 * Motion primitives — entrance reveals + a shared hover-lift, ALL gated on
 * prefers-reduced-motion via framer-motion's useReducedMotion(). When the user
 * prefers reduced motion, content renders instantly at its final state (no
 * transforms, no opacity fade) so nothing is hidden or animated.
 */

const RevealGroupContext = createContext(false);

type Direction = "up" | "down" | "left" | "right" | "none";

const OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 16 },
  down: { x: 0, y: -16 },
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
  none: { x: 0, y: 0 }
};

export type RevealProps = Omit<
  HTMLMotionProps<"div">,
  "initial" | "animate" | "variants" | "whileInView"
> & {
  /** Slide-in direction for the entrance. Default "up". */
  direction?: Direction;
  /** Seconds to wait before animating in. Ignored inside a group. */
  delay?: number;
  /** Animate on scroll-into-view instead of on mount. Default true. */
  inView?: boolean;
  /** Render as a stagger container for child <Reveal> items. */
  group?: boolean;
  /** Stagger between children when group is true (seconds). Default 0.08. */
  stagger?: number;
};

/**
 * <Reveal> — an entrance wrapper.
 *
 * Single element:
 *   <Reveal>…</Reveal>
 *   <Reveal direction="left" delay={0.1}>…</Reveal>
 *
 * Staggered group (children animate in sequence):
 *   <Reveal group>
 *     <Reveal>card a</Reveal>
 *     <Reveal>card b</Reveal>
 *   </Reveal>
 */
export function Reveal({
  direction = "up",
  delay = 0,
  inView = true,
  group = false,
  stagger = 0.08,
  children,
  ...rest
}: RevealProps) {
  const reduce = useReducedMotion();
  const inGroup = useContext(RevealGroupContext);

  if (group) {
    const container = {
      hidden: {},
      visible: { transition: { staggerChildren: reduce ? 0 : stagger } }
    };
    const viewProps = inView
      ? { whileInView: "visible" as const, viewport: { once: true, amount: 0.2 } }
      : { animate: "visible" as const };
    return (
      <RevealGroupContext.Provider value={true}>
        <motion.div initial="hidden" variants={container} {...viewProps} {...rest}>
          {children}
        </motion.div>
      </RevealGroupContext.Provider>
    );
  }

  const offset = reduce ? OFFSET.none : OFFSET[direction];
  const variants = {
    hidden: { opacity: 0, x: offset.x, y: offset.y },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1], delay: inGroup ? 0 : delay }
    }
  };

  // Inside a group, inherit the parent's variant state (stagger). Standalone,
  // drive the animation directly.
  if (inGroup) {
    return (
      <motion.div variants={variants} {...rest}>
        {children}
      </motion.div>
    );
  }

  const viewProps = inView
    ? { whileInView: "visible" as const, viewport: { once: true, amount: 0.2 } }
    : { animate: "visible" as const };

  return (
    <motion.div initial="hidden" variants={variants} {...viewProps} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Hook returning hover/tap props for a subtle lift, disabled under reduced
 * motion. Spread onto any motion element:
 *   const lift = useHoverLift();
 *   <motion.div {...lift}>…</motion.div>
 */
export function useHoverLift(amount = 3) {
  const reduce = useReducedMotion();
  if (reduce) return {};
  return {
    whileHover: { y: -amount, transition: { duration: 0.2, ease: "easeOut" as const } },
    whileTap: { y: 0, scale: 0.99 }
  };
}
