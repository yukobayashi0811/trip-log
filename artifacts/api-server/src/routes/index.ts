import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tripsRouter from "./trips";
import stopsRouter from "./stops";
import routingRouter from "./routing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(routingRouter);
router.use(stopsRouter);
router.use(tripsRouter);

export default router;
