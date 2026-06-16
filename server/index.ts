import express from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";

const app = express();
app.use(express.json());
app.use(cookieParser());

registerRoutes(app);

if (process.env.NODE_ENV === "production") {
  const { serveStatic } = await import("./static");
  serveStatic(app);
}

const port = Number(process.env.PORT ?? 5000);
app.listen(port, () => console.log(`oraeorae on :${port}`));
