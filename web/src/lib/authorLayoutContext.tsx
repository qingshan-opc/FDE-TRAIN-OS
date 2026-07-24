import { createContext, useContext, type ReactNode, type RefObject } from "react";

export type AuthorLayoutContextValue = {
  getHeaderPopupContainer: () => HTMLElement;
  getSiderPopupContainer: () => HTMLElement;
  getContentPopupContainer: () => HTMLElement;
};

const defaultGet = () => document.body;

const AuthorLayoutContext = createContext<AuthorLayoutContextValue>({
  getHeaderPopupContainer: defaultGet,
  getSiderPopupContainer: defaultGet,
  getContentPopupContainer: defaultGet,
});

export function AuthorLayoutProvider({
  headerRef,
  siderRef,
  contentRef,
  children,
}: {
  headerRef: RefObject<HTMLElement | null>;
  siderRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const value: AuthorLayoutContextValue = {
    getHeaderPopupContainer: () => headerRef.current || document.body,
    getSiderPopupContainer: () => siderRef.current || document.body,
    getContentPopupContainer: () => contentRef.current || document.body,
  };
  return <AuthorLayoutContext.Provider value={value}>{children}</AuthorLayoutContext.Provider>;
}

export function useAuthorLayout() {
  return useContext(AuthorLayoutContext);
}

/** Prefer modal content, then author main column, then body. */
export function authorSelectPopup(getContent: () => HTMLElement) {
  return (trigger: HTMLElement): HTMLElement =>
    (trigger.closest(".ant-modal-content") as HTMLElement | null) ||
    (trigger.closest(".ant-drawer-content") as HTMLElement | null) ||
    getContent() ||
    document.body;
}
