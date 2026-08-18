import { useWindowDimensions } from "react-native";

/**
 * Narrowest iPad in portrait is the mini at 744pt, and the widest phone
 * (Pro Max landscape aside — the app is portrait-locked) stays well under
 * this, so a single threshold separates the two form factors.
 */
export const TABLET_MIN_WIDTH = 700;

/**
 * Widest a form / reading column is allowed to get. Left unbounded, every
 * form row and settings card would stretch across a 1024pt iPad, which puts
 * a label at one edge and its value at the other.
 */
export const CONTENT_MAX_WIDTH = 560;

/**
 * Cap for content that genuinely reads better wide — charts, projection
 * tables. Still bounded so a 1366pt iPad Pro does not stretch a chart into a
 * letterbox strip.
 */
export const WIDE_CONTENT_MAX_WIDTH = 820;

export interface Responsive {
  width: number;
  height: number;
  isTablet: boolean;
  /** Full-bleed on phones, a centred column on tablets. */
  contentWidth: number;
  /** Same idea as `contentWidth`, for charts and tables. */
  wideContentWidth: number;
}

/**
 * Window-size-derived layout facts.
 *
 * Deliberately built on `useWindowDimensions` rather than a module-level
 * `Dimensions.get("window")`: the latter is captured once at import time, so
 * anything sized from it keeps a stale width after an iPad rotates or is
 * resized in Split View / Slide Over.
 */
export function useResponsive(): Responsive {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= TABLET_MIN_WIDTH;

  return {
    width,
    height,
    isTablet,
    contentWidth: isTablet ? Math.min(width, CONTENT_MAX_WIDTH) : width,
    wideContentWidth: isTablet ? Math.min(width, WIDE_CONTENT_MAX_WIDTH) : width,
  };
}
