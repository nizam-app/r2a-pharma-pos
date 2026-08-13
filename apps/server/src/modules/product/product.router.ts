import { Router } from "express";
import {
  idParamSchema,
  productCreateSchema,
  productIdParamSchema,
  productSearchSchema,
  productUpdateSchema,
} from "@r2a/shared-types";
import { restrictTo } from "../../middlewares/protect";
import { validate } from "../../middlewares/validate";
import * as productController from "./product.controller";

const productRouter = Router();

productRouter.get(
  "/",
  validate({ query: productSearchSchema }),
  productController.search,
);

productRouter.post(
  "/",
  restrictTo("OWNER", "MANAGER"),
  validate({ body: productCreateSchema }),
  productController.create,
);

productRouter.get(
  "/:productId/fefo-batch",
  validate({ params: productIdParamSchema }),
  productController.fefoBatch,
);

productRouter.get(
  "/:productId/substitutes",
  validate({ params: productIdParamSchema }),
  productController.substitutes,
);

productRouter.get(
  "/:id",
  validate({ params: idParamSchema }),
  productController.getById,
);

productRouter.patch(
  "/:id",
  restrictTo("OWNER", "MANAGER"),
  validate({ params: idParamSchema, body: productUpdateSchema }),
  productController.update,
);

export default productRouter;
