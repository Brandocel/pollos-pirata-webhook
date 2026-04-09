import { Router } from "express";
import { getPrivacyPage } from "../controllers/public.controller";

const router = Router();

router.get("/privacy", getPrivacyPage);

export default router;