import type { Transition, Variants } from 'motion/react';

export const spring: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 28,
  mass: 0.9,
};

export const softSpring: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 24,
};

export const snappy: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 32,
};

export const stagger = (delay = 0.06, initial = 0.08): Transition => ({
  staggerChildren: delay,
  delayChildren: initial,
});

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export const lift: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -3, scale: 1.01, transition: spring },
};
