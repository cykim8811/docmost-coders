/* SPDX-License-Identifier: AGPL-3.0-only
 * Independently written compatibility boundary for the community build.
 * No Enterprise implementation is included or enabled here.
 */
import { atom } from "jotai";
import type { ComponentType } from "react";
export { Feature } from "./features";

const unavailable = (..._args: unknown[]) => {
  throw new Error("This feature is unavailable in the community edition");
};
const noop = () => {};
const emptyMutation = Object.freeze({
  isPending: false,
  mutate: unavailable,
  mutateAsync: async (..._args: unknown[]) => unavailable(),
});
const emptyQuery = Object.freeze({
  data: undefined,
  isLoading: false,
  isError: false,
});

const entitlements = { features: [] as string[], tier: "free", isValid: false };
const entitlementQuery = { data: entitlements };
export const entitlementAtom = atom(entitlements);
export const useEntitlements = () => entitlementQuery;
export const useHasFeature = (_feature: string) => false;
export const useUpgradeLabel = () => "이 버전에서 제공하지 않는 기능입니다";
export const useTrial = () => ({ isTrial: false, trialDaysLeft: 0 });
export const useTrialEndAction = noop;
export const useRedirectToCloudSelect = noop;
export const UnavailableFeature: ComponentType<any> = () => null;
export const BaseView = UnavailableFeature;
export const BaseTableSkeleton = UnavailableFeature;
export const PageShareModal = UnavailableFeature;
export const PageVerificationBadge = UnavailableFeature;
export const PageVerificationMenuItem = UnavailableFeature;
export const PageVerificationModal = UnavailableFeature;
export const EditorAiMenu = UnavailableFeature;
export const MfaSettings = UnavailableFeature;
export const PosthogUser = UnavailableFeature;
export const AiSearchResult = UnavailableFeature;
export const useBaseQuery = (..._args: unknown[]) => emptyQuery;
export const usePersonalSpaceQuery = (..._args: unknown[]) => emptyQuery;
export const useConvertPageToBaseMutation = () => emptyMutation;
export const useResolveCommentMutation = () => emptyMutation;
export const useAiSearch = () => ({
  data: undefined,
  isPending: false,
  mutate: unavailable,
  reset: noop,
  error: undefined,
  streamingAnswer: "",
  streamingSources: [],
  clearStreaming: noop,
});
export const hintVectorCache = noop;
export const getBilling = async (..._args: unknown[]) => unavailable();
export const getBillingPlans = getBilling;
export const getLicenseInfo = getBilling;
export const getSsoProviders = getBilling;
export const getApiKeys = getBilling;
export const getAuditLogs = getBilling;
export const getVerificationList = getBilling;
export const getScimTokens = getBilling;
export const getTemplateById = getBilling;
export const applyTemplateToPage = (..._args: unknown[]) => false;
export const exchangeTokenRedirectUrl = (..._args: unknown[]): string =>
  unavailable();
export const getHostnameUrl = (..._args: unknown[]): string => unavailable();
export type IApiKey = { id: string; name: string };
export type IAuthProvider = { id: string; name: string; type: string };
export type ITemplate = { id: string; name: string; content?: unknown };
export type ChatAttachment = { id: string; name: string };
export type PageMention = { id: string; title: string };
