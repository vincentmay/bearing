/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as follows from "../follows.js";
import type * as ingest from "../ingest.js";
import type * as leaguepedia from "../leaguepedia.js";
import type * as lichess from "../lichess.js";
import type * as lolesports from "../lolesports.js";
import type * as pandascore from "../pandascore.js";
import type * as retention from "../retention.js";
import type * as sample from "../sample.js";
import type * as validators from "../validators.js";
import type * as world from "../world.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  follows: typeof follows;
  ingest: typeof ingest;
  leaguepedia: typeof leaguepedia;
  lichess: typeof lichess;
  lolesports: typeof lolesports;
  pandascore: typeof pandascore;
  retention: typeof retention;
  sample: typeof sample;
  validators: typeof validators;
  world: typeof world;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
