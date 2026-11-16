/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vite-plus/test";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const vitality = { kind: "team", id: "cs2-vitality" } as const;
const carlsen = { kind: "player", id: "chess-carlsen" } as const;
const masters = { kind: "tournament", id: "cs2-copenhagen-masters-2026" } as const;

describe("follows", () => {
  test("nobody signed in has no account follows and cannot write any", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.follows.list, {})).toBeNull();
    await expect(t.mutation(api.follows.toggle, { follow: vitality })).rejects.toThrow();
    await expect(t.mutation(api.follows.merge, { follows: [vitality] })).rejects.toThrow();
    await expect(t.mutation(api.follows.clear, {})).rejects.toThrow();
  });

  test("a follow is added by one tap and removed by the next", async () => {
    const t = convexTest(schema, modules);
    const ada = t.withIdentity({ subject: "ada", issuer: "https://clerk.test" });
    await ada.mutation(api.follows.toggle, { follow: vitality });
    expect(await ada.query(api.follows.list, {})).toEqual([vitality]);
    await ada.mutation(api.follows.toggle, { follow: vitality });
    expect(await ada.query(api.follows.list, {})).toEqual([]);
  });

  test("one account never sees or changes another's follows", async () => {
    const t = convexTest(schema, modules);
    const ada = t.withIdentity({ subject: "ada", issuer: "https://clerk.test" });
    const ben = t.withIdentity({ subject: "ben", issuer: "https://clerk.test" });
    await ada.mutation(api.follows.toggle, { follow: vitality });
    await ben.mutation(api.follows.toggle, { follow: carlsen });
    expect(await ada.query(api.follows.list, {})).toEqual([vitality]);
    expect(await ben.query(api.follows.list, {})).toEqual([carlsen]);
    await ben.mutation(api.follows.clear, {});
    expect(await ben.query(api.follows.list, {})).toEqual([]);
    expect(await ada.query(api.follows.list, {})).toEqual([vitality]);
  });

  test("the same subject at another sign-in provider is a different account", async () => {
    const t = convexTest(schema, modules);
    const here = t.withIdentity({ subject: "ada", issuer: "https://clerk.test" });
    const there = t.withIdentity({ subject: "ada", issuer: "https://elsewhere.test" });
    await here.mutation(api.follows.toggle, { follow: vitality });
    expect(await there.query(api.follows.list, {})).toEqual([]);
  });

  test("carrying device follows over adds what is missing and takes nothing away", async () => {
    const t = convexTest(schema, modules);
    const ada = t.withIdentity({ subject: "ada", issuer: "https://clerk.test" });
    await ada.mutation(api.follows.toggle, { follow: vitality });
    await ada.mutation(api.follows.merge, { follows: [vitality, carlsen, carlsen, masters] });
    const list = await ada.query(api.follows.list, {});
    expect(list).toHaveLength(3);
    expect(list).toEqual(expect.arrayContaining([vitality, carlsen, masters]));
    // Carrying the same list over again changes nothing.
    await ada.mutation(api.follows.merge, { follows: [vitality, carlsen, masters] });
    expect(await ada.query(api.follows.list, {})).toHaveLength(3);
  });

  test("an account cannot be used as storage", async () => {
    const t = convexTest(schema, modules);
    const ada = t.withIdentity({ subject: "ada", issuer: "https://clerk.test" });
    const many = Array.from(
      { length: 600 },
      (_, i) => ({ kind: "team", id: `team-${i}` }) as const,
    );
    await ada.mutation(api.follows.merge, { follows: many });
    expect(await ada.query(api.follows.list, {})).toHaveLength(500);
    await expect(
      ada.mutation(api.follows.toggle, { follow: { kind: "team", id: "one-more" } }),
    ).rejects.toThrow();
    await expect(
      ada.mutation(api.follows.toggle, { follow: { kind: "team", id: "x".repeat(300) } }),
    ).rejects.toThrow();
  });
});
