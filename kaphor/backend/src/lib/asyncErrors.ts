/**
 * Express 4 does not catch rejected promises from async route handlers, which
 * leaves requests hanging and can crash the process. This patches the router
 * layer once so rejected handlers are forwarded to the error middleware.
 * Import this file before any router is created.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Layer = require('express/lib/router/layer');

if (!Layer.prototype.__asyncPatched) {
  const original = Layer.prototype.handle_request;
  Layer.prototype.handle_request = function patched(req: any, res: any, next: any) {
    const fn = this.handle;
    if (fn.length > 3) return next(); // error middleware: untouched
    try {
      const out = fn(req, res, next);
      if (out && typeof out.catch === 'function') out.catch(next);
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.__asyncPatched = true;
  void original;
}
export {};
