/**
 * Vercel detects this root-level default Express export and runs the exact
 * same application factory that powers the local and managed deployments.
 */
import express, { type Express } from "express";
import { createApp } from "./server/_core/index";

// Keep the direct Express import in this entrypoint. Vercel's Express preset
// detects serverless applications by inspecting the entrypoint itself.
void express;

const app: Express = createApp();

export default app;
