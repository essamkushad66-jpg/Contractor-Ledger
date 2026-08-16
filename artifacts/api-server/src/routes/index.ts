import { Hono } from "hono";
import healthRouter from "./health";
import projectsRouter from "./projects";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import vendorsRouter from "./vendors";
import activityRouter from "./activity";
import recurringRouter from "./recurring";
import changeOrdersRouter from "./change-orders";
import photosRouter from "./photos";

const router = new Hono();

router.route("/", healthRouter);
router.route("/", projectsRouter);
router.route("/", transactionsRouter);
router.route("/", dashboardRouter);
router.route("/", storageRouter);
router.route("/", vendorsRouter);
router.route("/", activityRouter);
router.route("/", recurringRouter);
router.route("/", changeOrdersRouter);
router.route("/", photosRouter);

export default router;
