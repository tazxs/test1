/**
 * Framer Motion animation presets — used across all components.
 * Import these instead of defining inline variants.
 */
import type { Variants, Transition, TargetAndTransition } from 'framer-motion'

// ── Page transitions ──────────────────────────────────────────────────────────
export const PAGE_TRANSITION: Variants = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}

export const PAGE_TRANSITION_CONFIG: Transition = {
  duration: 0.35,
  ease: [0.25, 0.46, 0.45, 0.94],
}

// ── Fade up (sections, cards) ─────────────────────────────────────────────────
export const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
}

export const FADE_UP_CONFIG: Transition = {
  duration: 0.5,
  ease: 'easeOut',
}

// ── Stagger container ─────────────────────────────────────────────────────────
export const STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

// ── Scale in (buttons, badges) ────────────────────────────────────────────────
export const SCALE_IN: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1 },
}

// ── Slide down (dropdowns, modals) ────────────────────────────────────────────
export const SLIDE_DOWN: Variants = {
  hidden: { opacity: 0, y: -8, scaleY: 0.95 },
  visible: { opacity: 1, y: 0, scaleY: 1 },
  exit: { opacity: 0, y: -8, scaleY: 0.95 },
}

export const SLIDE_DOWN_CONFIG: Transition = {
  duration: 0.2,
  ease: 'easeOut',
}

// ── Modal backdrop ────────────────────────────────────────────────────────────
export const BACKDROP: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

export const MODAL_CONTENT: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 16 },
}

export const MODAL_TRANSITION: Transition = {
  duration: 0.25,
  ease: [0.25, 0.46, 0.45, 0.94],
}

// ── Card hover lift ───────────────────────────────────────────────────────────
export const CARD_HOVER: { whileHover: TargetAndTransition } = {
  whileHover: { y: -4, transition: { duration: 0.25, ease: 'easeOut' } },
}

// ── Float animation (hero card) ───────────────────────────────────────────────
export const FLOAT_ANIMATION: { animate: TargetAndTransition; transition: Transition } = {
  animate: { y: [0, -8, 0] },
  transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
}

// ── Toast slide in ────────────────────────────────────────────────────────────
export const TOAST_VARIANTS: Variants = {
  hidden: { opacity: 0, x: 64, scale: 0.95 },
  visible: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 64, scale: 0.95 },
}

export const TOAST_TRANSITION: Transition = {
  duration: 0.3,
  ease: [0.25, 0.46, 0.45, 0.94],
}

// ── Logo dot pulse ────────────────────────────────────────────────────────────
export const LOGO_DOT_PULSE: { animate: TargetAndTransition; transition: Transition } = {
  animate: { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] },
  transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
}

// ── Mobile menu overlay ───────────────────────────────────────────────────────
export const MOBILE_MENU: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

export const MOBILE_MENU_ITEM: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
}
