import type { Handler } from './index.js';
import { JSONPath } from 'jsonpath-plus';

/** generic.http_request — fetch with config.url + method + headers + body. */
export const genericHttpRequestHandler: Handler = async (input, ctx) => {
  const cfg = ctx.stepConfig ?? {};
  const url = (cfg.url as string) || (input.payload.url as string);
  if (!url) {
    return {
      status: 'failed',
      output: { error: 'MissingUrl' },
      error: 'generic.http_request: config.url is required',
    };
  }
  const method = ((cfg.method as string) || 'GET').toUpperCase();
  const headers = ((cfg.headers as Record<string, string>) ?? {});
  const bodyCfg = cfg.body;
  const body =
    bodyCfg == null
      ? undefined
      : typeof bodyCfg === 'string'
        ? bodyCfg
        : JSON.stringify(bodyCfg);

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body });
  } catch (e) {
    return {
      status: 'failed',
      output: { error: 'NetworkError' },
      error: `generic.http_request network error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const ct = res.headers.get('content-type') ?? '';
  let parsed: unknown;
  if (ct.includes('application/json')) {
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
  } else {
    parsed = (await res.text()).slice(0, 8192);
  }

  const respHeaders: Record<string, string> = {};
  res.headers.forEach((v, k) => {
    respHeaders[k] = v;
  });

  return {
    status: res.ok ? 'done' : 'failed',
    output: { status: res.status, body: parsed, headers: respHeaders },
    error: res.ok ? undefined : `HTTP ${res.status}`,
  };
};

/** generic.transform_json — apply a JSONPath expression. */
export const genericTransformJsonHandler: Handler = async (input, ctx) => {
  const cfg = ctx.stepConfig ?? {};
  const path = (cfg.path as string) || '$';
  const sourceKey = cfg.sourceKey as string | null | undefined;
  const source: unknown = sourceKey ? input.payload[sourceKey] : input.payload;
  let result: unknown;
  try {
    result = JSONPath({ path, json: source as object });
  } catch (e) {
    return {
      status: 'failed',
      output: { error: 'JsonPathError' },
      error: `generic.transform_json: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  // Unwrap single-element arrays for ergonomic chaining
  if (Array.isArray(result) && result.length === 1) result = result[0];
  return { output: { result } };
};

/**
 * generic.condition — evaluate a JS-style boolean against the payload.
 * Branching itself (nextStepIfTrue / nextStepIfFalse) requires executor support
 * the existing graph doesn't model; for now we emit the boolean as `result` so
 * downstream nodes (or a future router) can act on it. Safe-eval is done via
 * `new Function` over a frozen `input` proxy — no closures, no globals.
 */
export const genericConditionHandler: Handler = async (input, ctx) => {
  const cfg = ctx.stepConfig ?? {};
  const expr = (cfg.condition as string) || 'false';
  let result = false;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('input', `"use strict"; return (${expr});`);
    result = Boolean(fn(input.payload));
  } catch (e) {
    return {
      status: 'failed',
      output: { error: 'ConditionEvalError', expr },
      error: `generic.condition: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return {
    output: {
      result,
      condition: expr,
      // Surface routing hints for a future branching executor (P3.12+).
      nextStepIfTrue: cfg.nextStepIfTrue ?? null,
      nextStepIfFalse: cfg.nextStepIfFalse ?? null,
    },
  };
};

/** generic.delay — pause for config.seconds. */
export const genericDelayHandler: Handler = async (_input, ctx) => {
  const cfg = ctx.stepConfig ?? {};
  const seconds = Number(cfg.seconds ?? 1);
  const ms = Math.max(0, Math.min(60_000, Math.round(seconds * 1000))); // cap at 60s for serverless
  await new Promise((r) => setTimeout(r, ms));
  return { output: { waitedMs: ms } };
};
