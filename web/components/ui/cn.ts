import clsx, { type ClassValue } from "clsx";

/** Tiny class-name combiner. Thin wrapper over clsx (already a dependency). */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
