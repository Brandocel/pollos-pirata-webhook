import { Router } from "express";
import {
  activateIntegration,
  testIntegrationActivationScopes
} from "../controllers/uberIntegrationActivation.controller";

const router = Router();

router.get("/integration-activation/scopes/test", testIntegrationActivationScopes);
router.get("/integration-activation/activate", activateIntegration);

export default router;