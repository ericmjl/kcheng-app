/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as contacts from "../contacts.js";
import type * as crons from "../crons.js";
import type * as dossiers from "../dossiers.js";
import type * as events from "../events.js";
import type * as lib_auth from "../lib/auth.js";
import type * as plannedRoutes from "../plannedRoutes.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as reminders from "../reminders.js";
import type * as todos from "../todos.js";
import type * as tripNotes from "../tripNotes.js";
import type * as userSettings from "../userSettings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  contacts: typeof contacts;
  crons: typeof crons;
  dossiers: typeof dossiers;
  events: typeof events;
  "lib/auth": typeof lib_auth;
  plannedRoutes: typeof plannedRoutes;
  pushSubscriptions: typeof pushSubscriptions;
  reminders: typeof reminders;
  todos: typeof todos;
  tripNotes: typeof tripNotes;
  userSettings: typeof userSettings;
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
