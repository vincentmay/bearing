/** The three places of the frame: everything else is a page further in. */
export const PLACES = ["/", "/schedule", "/following"] as const;

/** Which place an address belongs to (its index), or -1 for a page further in. */
export function placeOf(path: string): number {
  return PLACES.findIndex((to) => (to === "/" ? path === "/" : path.startsWith(to)));
}

/**
 * How one address is reached from another: between places ("tab"), into a page further in
 * ("in"), or back out to a place ("out"). The page arrives accordingly.
 */
export function moveOf(from: string, to: string): "tab" | "in" | "out" {
  if (placeOf(to) < 0) return "in";
  return placeOf(from) < 0 ? "out" : "tab";
}
