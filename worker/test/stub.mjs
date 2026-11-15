// Node has no cloudflare:workers module, so the tests get a minimal stand-in.
import { registerHooks } from "node:module";
registerHooks({
  resolve: (specifier, context, next) => specifier === "cloudflare:workers"
    ? { url: "data:text/javascript,export class WorkerEntrypoint { constructor(c, e) { this.env = e; } }", shortCircuit: true }
    : next(specifier, context),
});
