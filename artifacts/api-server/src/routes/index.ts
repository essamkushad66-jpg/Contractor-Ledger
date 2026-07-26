import { Hono } from "hono";
import healthRouter from "./health";
import projectsRouter from "./projects";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import vendorsRouter from "./vendors";

const router = new Hono();

router.route("/", healthRouter);
router.route("/", projectsRouter);
router.route("/", transactionsRouter);
router.route("/", dashboardRouter);
router.route("/", storageRouter);
router.route("/", vendorsRouter);

export default router;
