import type { Transition } from "framer-motion";

/**
 * EasyUI Motion Design Tokens (MIT)
 * Tuned for critical-damping Apple-HIG micro-physics: immediate, tactile, zero slop.
 */
export const motionTransitions = {
  springGentle: {
    type: "spring",
    stiffness: 170,
    damping: 26,
    mass: 0.9,
  } as Transition,

  springSmooth: {
    type: "spring",
    stiffness: 200,
    damping: 28,
    mass: 0.85,
  } as Transition,

  springSnappy: {
    type: "spring",
    stiffness: 380,
    damping: 30,
    mass: 0.5,
  } as Transition,

  springMorph: {
    type: "spring",
    stiffness: 220,
    damping: 32,
    mass: 1.0,
  } as Transition,

  springResponsive: {
    type: "spring",
    stiffness: 320,
    damping: 24,
    mass: 0.7,
  } as Transition,

  easeSoft: {
    duration: 0.32,
    ease: [0.22, 1, 0.36, 1],
  } as Transition,

  easeFast: {
    duration: 0.2,
    ease: [0.2, 0, 0, 1],
  } as Transition,
};
