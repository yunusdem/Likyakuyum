import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { createUserSchema, updateUserSchema, getUserByIdSchema, listUsersQuerySchema, } from "../schemas/user.schema.js";
const router = Router();
// All user management routes require authentication
router.use(authenticate);
// List & Create Users (Accessible by Authenticated Users)
router.get("/", validate(listUsersQuerySchema), UserController.listUsers);
router.post("/", validate(createUserSchema), UserController.createUser);
// Cashiers definition list
router.get("/cashiers", UserController.getCashiers);
// Direct Appearance Update for Authenticated User
router.put("/appearance", UserController.updateMyAppearance);
router.patch("/appearance", UserController.updateMyAppearance);
// Single User CRUD
router.get("/:id", validate(getUserByIdSchema), UserController.getUserById);
router.put("/:id", validate(updateUserSchema), UserController.updateUser);
router.delete("/:id", validate(getUserByIdSchema), UserController.deleteUser);
export default router;
