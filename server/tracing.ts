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
   - a request's address goes without its ?query part, which can hold what someone searched for.
   OTEL_SERVICE_NAME names the server in the collector (default "dukkan"); the other OTEL_* settings of the exporter
   (headers, a /v1/traces address of its own) work as usual. */

/* the address part of a request, without what follows "?" */
const pathOnly = (url: string | undefined) => (url ?? "").split("?")[0];

export function startTracing(): void {
  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "dukkan",
    traceExporter: new OTLPTraceExporter(),
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
