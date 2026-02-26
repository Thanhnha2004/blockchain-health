import express from "express";
import dotenv from "dotenv";
import recordsRouter from "./routes/records.router";
import accessRouter from "./routes/access.router";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/records", recordsRouter);
app.use("/access", accessRouter);

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("ERROR:", err.message); // thêm dòng này
    res.status(500).json({ error: err.message });
  },
);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
