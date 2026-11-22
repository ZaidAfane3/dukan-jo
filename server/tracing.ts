import type { IncomingMessage } from "node:http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { NodeSDK } from "@opentelemetry/sdk-node";

/* Tracing of slow requests (OpenTelemetry), started by instrumentation.ts only when OTEL_EXPORTER_OTLP_ENDPOINT is set
   (the address of a collector Dukkan runs itself: Jaeger, Tempo or SigNoz, for example http://collector:4318). Without
   it nothing here is loaded and nothing is sent anywhere.

   Each request to the site becomes a trace: Next.js's own steps (the route, the page drawing), each database query
   (server/db.ts) and each call out, with how long each took. What leaves the server is kept to timings and names:
   - a query's SQL is sent (it never holds a value: values are always parameters), its parameters never
     (enhancedDatabaseReporting off);
   - a request's address goes without its ?query part, which can hold what someone searched for (full emails and
     mobiles). Next.js writes the address on its own spans too, out of reach of the hook below, so every span is also
     cleaned on its way out (withoutQueries): any address in it is cut at the "?", whoever wrote it.
   OTEL_SERVICE_NAME names the server in the collector (default "dukkan"); the other OTEL_* settings of the exporter
   (headers, a /v1/traces address of its own) work as usual. */

/* the address part of a request, without what follows "?" */
const pathOnly = (url: string | undefined) => (url ?? "").split("?")[0];

type TraceExporter = NonNullable<NonNullable<ConstructorParameters<typeof NodeSDK>[0]>["traceExporter"]>;
type Spans = Parameters<TraceExporter["export"]>[0];

/* the attributes that hold a request's address (old and new names) */
const URL_KEYS = new Set(["http.target", "http.url", "url.full", "url.path", "next.route", "http.route"]);
/* a text that is an address ("/x?…" or "https://host/x?…") */
const LOOKS_LIKE_URL = /^(\/|[a-z][a-z0-9+.-]*:\/\/)/i;

/** Every span's addresses without their ?query part, just before the spans leave the server: Next.js's own request
    span keeps the full address (with what was searched for) in http.target, whatever the hook above does */
function cutQueries(spans: Spans): Spans {
  return spans.filter((span) => {
    try {
      const at = span.attributes as Record<string, unknown>;
      for (const k of Object.keys(at)) {
        const v = at[k];
        if (k === "url.query") at[k] = "";
        else if (typeof v === "string" && v.includes("?") && (URL_KEYS.has(k) || LOOKS_LIKE_URL.test(v))) at[k] = pathOnly(v);
      }
      if (span.name.includes("?")) (span as { name: string }).name = pathOnly(span.name);
      return true;
    } catch {
      /* a span that can't be cleaned is not sent at all */
      return false;
    }
  });
}

/** The exporter, sending each span only after cutQueries */
function withoutQueries(inner: TraceExporter): TraceExporter {
  return {
    export: (spans, done) => inner.export(cutQueries(spans), done),
    shutdown: () => inner.shutdown(),
    forceFlush: () => inner.forceFlush?.() ?? Promise.resolve(),
  };
}

export function startTracing(): void {
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "dukkan",
    traceExporter: withoutQueries(new OTLPTraceExporter()),
    instrumentations: [
      new HttpInstrumentation({
        /* the build's own files and the health check are not worth a trace each */
        ignoreIncomingRequestHook: (req) => /^\/(_next\/|api\/health)/.test(req.url ?? ""),
        requestHook: (span, req) => {
          if (!("headers" in req) || typeof (req as IncomingMessage).url !== "string") return;
          const path = pathOnly((req as IncomingMessage).url);
          for (const k of ["http.target", "http.url", "url.full", "url.path"]) span.setAttribute(k, path);
          span.setAttribute("url.query", "");
        },
      }),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
    ],
  });
  sdk.start();
  console.log(`[tracing] sending traces to ${process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`);
}
