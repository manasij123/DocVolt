import { useWindowDimensions, Platform } from "react-native";

export type Breakpoint = "mobile" | "tablet" | "desktop";

export function useResponsive() {
  const { width } = useWindowDimensions();

  // Native (iOS/Android) builds are always treated as mobile regardless of width
  // (e.g. tablets still use the same native layouts to avoid regression).
  const forceMobile = Platform.OS !== "web";

  const isMobile = forceMobile || width < 768;
  const isTablet = !forceMobile && width >= 768 && width < 1100;
  const isDesktop = !forceMobile && width >= 1100;

  const breakpoint: Breakpoint = isDesktop ? "desktop" : isTablet ? "tablet" : "mobile";

  return {
    width,
    isMobile,
    isTablet,
    isDesktop,
    breakpoint,
    // Common content max-widths
    contentMaxWidth: isDesktop ? 1200 : isTablet ? 720 : "100%",
    listMaxWidth: isDesktop ? 980 : isTablet ? 720 : "100%",
    // Document grid columns
    docColumns: isDesktop ? 3 : isTablet ? 2 : 1,
  };
}
