export function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

export function navLinkLightClass({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link-light nav-link-light--active" : "nav-link-light";
}
