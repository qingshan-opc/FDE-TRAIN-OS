import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { scrollPageToTop } from "../lib/scrollPageToTop";

/** Reset scroll position whenever the SPA route pathname changes. */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    scrollPageToTop();
  }, [pathname]);

  return null;
}
