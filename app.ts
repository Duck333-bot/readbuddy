/**
 * Vercel detects this root-level default Express export and runs the exact
 * same application factory that powers the local and managed deployments.
 */
import { createApp } from "./server/_core/index";

export default createApp();
