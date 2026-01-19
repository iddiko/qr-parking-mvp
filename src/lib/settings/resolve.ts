import type { MenuToggles, MenuOrder, MenuLabels } from "./types";
import { defaultMenuLabels, defaultMenuOrder, defaultMenuToggles } from "./defaults";

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

const normalizeOrder = (order: unknown, fallback: string[]) => {
  const list = Array.isArray(order) ? order.filter((key) => typeof key === "string") : [];
  const unique = Array.from(new Set(list)).filter((key) => fallback.includes(key));
  const missing = fallback.filter((key) => !unique.includes(key));
  return [...unique, ...missing];
};

export function resolveMenuOrder(input?: Partial<MenuOrder> | null): MenuOrder {
  return {
    super: normalizeOrder(input?.super, defaultMenuOrder.super),
    main: normalizeOrder(input?.main, defaultMenuOrder.main),
    sub: normalizeOrder(input?.sub, defaultMenuOrder.sub),
    guard: normalizeOrder(input?.guard, defaultMenuOrder.guard),
    resident: normalizeOrder(input?.resident, defaultMenuOrder.resident),
  };
}

export function resolveMenuLabels(input?: Partial<MenuLabels> | null): MenuLabels {
  return {
    super: { ...defaultMenuLabels.super, ...(input?.super ?? {}) },
    main: { ...defaultMenuLabels.main, ...(input?.main ?? {}) },
    sub: { ...defaultMenuLabels.sub, ...(input?.sub ?? {}) },
    guard: { ...defaultMenuLabels.guard, ...(input?.guard ?? {}) },
    resident: { ...defaultMenuLabels.resident, ...(input?.resident ?? {}) },
  };
}
