import { describe, it, expect } from "vitest";
import type { HookContext } from "@feathersjs/feathers";
import { replaceResult } from "./replace-result.util.js";

const ctx = (method: string, result: any, dispatch?: any): HookContext =>
  ({ type: "after", method, result, dispatch }) as any;

describe("replaceResult", () => {
  it("replaces a single (get) result", () => {
    const context = ctx("get", { id: 1, name: "a" });
    replaceResult(context, [{ id: 1, name: "b" }]);
    expect(context.result).toEqual({ id: 1, name: "b" });
  });

  it("replaces an array (find, non-paginated) result", () => {
    const context = ctx("find", [{ n: 1 }, { n: 2 }]);
    replaceResult(context, [{ n: 9 }]);
    expect(context.result).toEqual([{ n: 9 }]);
  });

  it("replaces a paginated result.data, preserving the envelope", () => {
    const context = ctx("find", {
      total: 2,
      limit: 10,
      skip: 0,
      data: [{ n: 1 }, { n: 2 }],
    });
    replaceResult(context, [{ n: 1 }]);
    expect(context.result).toEqual({
      total: 2,
      limit: 10,
      skip: 0,
      data: [{ n: 1 }],
    });
  });

  it("writes to context.dispatch when dispatch is true, leaving result intact", () => {
    const context = ctx("get", { id: 1, secret: "x", name: "a" });
    replaceResult(context, [{ id: 1, name: "a" }], { dispatch: true });
    expect(context.dispatch).toEqual({ id: 1, name: "a" });
    expect(context.result).toEqual({ id: 1, secret: "x", name: "a" });
  });

  it('writes both result and dispatch with dispatch: "both"', () => {
    const context = ctx("get", { id: 1, name: "a" });
    replaceResult(context, [{ id: 1, name: "b" }], { dispatch: "both" });
    expect(context.result).toEqual({ id: 1, name: "b" });
    expect(context.dispatch).toEqual({ id: 1, name: "b" });
  });

  it("returns the context", () => {
    const context = ctx("get", { a: 1 });
    expect(replaceResult(context, [{ a: 2 }])).toBe(context);
  });
});
