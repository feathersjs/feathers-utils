import { describe, it, expect } from "vitest";
import type { HookContext } from "@feathersjs/feathers";
import { replaceData } from "./replace-data.util.js";

const ctx = (data: any): HookContext =>
  ({ type: "before", method: "create", data }) as any;

describe("replaceData", () => {
  it("replaces a single data item, preserving the single shape", () => {
    const context = ctx({ name: "a" });
    replaceData(context, [{ name: "b" }]);
    expect(context.data).toEqual({ name: "b" });
  });

  it("replaces array data, preserving the array shape", () => {
    const context = ctx([{ n: 1 }, { n: 2 }]);
    replaceData(context, [{ n: 10 }]);
    expect(context.data).toEqual([{ n: 10 }]);
  });

  it("returns the context", () => {
    const context = ctx({ a: 1 });
    expect(replaceData(context, [{ a: 2 }])).toBe(context);
  });

  it("round-trips with getDataIsArray shape", () => {
    const context = ctx([{ n: 1 }, { n: 2 }]);
    replaceData(context, [{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(context.data).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });
});
