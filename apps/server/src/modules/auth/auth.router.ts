import { Router } from "express";
import {
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "@r2a/shared-types";
import { validate } from "../../middlewares/validate";
import * as authController from "./auth.controller";

const authRouter = Router();

authRouter.post(
  "/register",
  validate({ body: registerSchema }),
  authController.register,
);

authRouter.post(
  "/login",
  validate({ body: loginSchema }),
  authController.login,
);

authRouter.post(
  "/refresh",
  validate({ body: refreshTokenSchema }),
  authController.refresh,
);

authRouter.post(
  "/logout",
  validate({ body: refreshTokenSchema }),
  authController.logout,
);

export default authRouter;
