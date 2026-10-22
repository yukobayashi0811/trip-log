import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tripsRouter from "./trips";
import stopsRouter from "./stops";
import routingRouter from "./routing";
import staysRouter from "./stays";
import starsRouter from "./stars";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(routingRouter);
router.use(staysRouter);
router.use(stopsRouter);
router.use(starsRouter);
router.use(tripsRouter);

export default router;
