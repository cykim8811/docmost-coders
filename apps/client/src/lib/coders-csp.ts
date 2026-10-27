/* SPDX-License-Identifier: AGPL-3.0-only */
import { config } from "zod";
// Configure before importing application schemas: Core does not allow eval.
if (import.meta.env.VITE_CODERS === "true") config({ jitless: true });
