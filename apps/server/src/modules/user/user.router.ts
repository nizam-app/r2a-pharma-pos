import { Router } from "express";
import { staffCreateSchema } from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as userController from "./user.controller";

/**
 * Domain user routes — parent mount applies `protect` + `tenantContext`.
 * Staff create uses `req.ctx.tenantId` (JWT only).
 */
const userRouter = Router();

userRouter.get("/me", userController.getMe);

userRouter.post(
  "/",
  restrictTo("OWNER", "MANAGER"),
  validate({ body: staffCreateSchema }),
  userController.createStaff,
);

export default userRouter;
