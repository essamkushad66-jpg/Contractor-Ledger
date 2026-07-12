import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import transactionsRouter from "./transactions";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(transactionsRouter);
router.use(dashboardRouter);
router.use(storageRouter);

export default router;
