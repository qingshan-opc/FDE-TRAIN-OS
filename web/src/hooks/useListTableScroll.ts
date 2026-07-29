import { useEffect, useRef, useState } from "react";

/** Measure table body scroll.y so list pages fit one viewport. */
export function useListTableScroll(deps: unknown[] = []) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const measure = () => {
      const thead = el.querySelector(".ant-table-thead") as HTMLElement | null;
      const pagination = el.querySelector(".ant-table-pagination") as HTMLElement | null;
      const theadH = thead?.offsetHeight ?? 55;
      const paginationH = pagination?.offsetHeight ?? 56;
      const styles = window.getComputedStyle(el);
      const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const next = el.clientHeight - theadH - paginationH - padY - 6;
      setScrollY(Math.max(120, Math.floor(next)));
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, scrollY };
}
