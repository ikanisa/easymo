/**
 * Aurora Motion Presets
 * Framer Motion animation variants for consistent, fluid interactions
 */

import type { Variants, Transition } from 'framer-motion';

// ==================== Base Transitions ====================
export const springTransition: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

export const smoothTransition: Transition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1],
};

// ==================== Fade Animations ====================
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

// ==================== Slide Animations ====================
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15 },
  },
};

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springTransition,
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { duration: 0.15 },
  },
};

// ==================== Scale Animations ====================
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

// ==================== Stagger Animations ====================
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const listItem: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
};

// ==================== Micro-interactions ====================
export const press = {
  whileTap: { scale: 0.98 },
  transition: { type: 'spring', stiffness: 400, damping: 10 },
};

export const hover = {
  whileHover: { scale: 1.02 },
  transition: { type: 'spring', stiffness: 400, damping: 10 },
};

// ==================== Modal/Dialog Animations ====================
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: -20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 30,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: { duration: 0.15 },
  },
};

// ==================== Page Transitions ====================
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.15,
    },
  },
};
