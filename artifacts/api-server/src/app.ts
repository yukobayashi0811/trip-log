import express, { type Express, type ErrorRequestHandler } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
// Same-origin browser API only: do not grant arbitrary origins credentialed access.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);
app.use("/api", router);

const errorHandler: ErrorRequestHandler = (_err, req, res, _next) => {
  // Body-parser rejects malformed/oversized payloads before the private router.
  // Return a client error rather than disguising bad input as a server crash.
  if (_err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "Send a valid JSON body." });
    return;
  }
  if (_err?.type === "entity.too.large") {
    res.status(413).json({ error: "The request is too large." });
    return;
  }
  if (_err?.type === "charset.unsupported" || _err?.type === "encoding.unsupported") {
    res.status(415).json({ error: "Send JSON using UTF-8 without an unsupported Content-Encoding header." });
    return;
  }
  req.log.warn("Request could not be completed");
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
app.use(errorHandler);

export default app;
