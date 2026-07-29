import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollPageToTop } from "../lib/scrollPageToTop";

/** Reset scroll before paint — avoids long→short 页切换后仍能滑出页底空白。 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    scrollPageToTop();
  }, [pathname]);

  return null;
}
