/** Ant Design Select/Dropdown popup mount helpers. */
export function popupFromParent(trigger: HTMLElement): HTMLElement {
  return trigger.parentElement || document.body;
}

export function popupFromModalOrParent(trigger: HTMLElement): HTMLElement {
  return (
    (trigger.closest(".ant-modal-content") as HTMLElement | null) ||
    trigger.parentElement ||
    document.body
  );
}
