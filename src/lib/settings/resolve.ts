import type { MenuToggles } from "./types";
import { defaultMenuToggles } from "./defaults";

export function resolveMenuToggles(input?: Partial<MenuToggles> | null): MenuToggles {
  const guard = { ...defaultMenuToggles.guard, ...(input?.guard ?? {}) };
  const resident = { ...defaultMenuToggles.resident, ...(input?.resident ?? {}) };
  const main = { ...defaultMenuToggles.main, ...(input?.main ?? {}) };
  const sub = { ...defaultMenuToggles.sub, ...(input?.sub ?? {}) };

  if (input?.sub && "parking" in input.sub) {
    const parking = (input.sub as Record<string, boolean>).parking;
    if (typeof parking === "boolean") {
      if (sub["parking.qrs"] === undefined) {
        sub["parking.qrs"] = parking;
      }
      if (sub["parking.scans"] === undefined) {
        sub["parking.scans"] = parking;
      }
    }
  }
  if (input?.sub && "meter" in input.sub) {
    const meter = (input.sub as Record<string, boolean>).meter;
    if (typeof meter === "boolean") {
      if (sub["meter.cycles"] === undefined) {
        sub["meter.cycles"] = meter;
      }
      if (sub["meter.submissions"] === undefined) {
        sub["meter.submissions"] = meter;
      }
    }
  }

  return {
    main,
    guard,
    resident,
    sub,
  };
}
