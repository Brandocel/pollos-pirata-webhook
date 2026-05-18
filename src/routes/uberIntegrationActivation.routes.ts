import { Router } from "express";
import {
  activateIntegration,
  testIntegrationActivationMerchantSession
} from "../controllers/uberIntegrationActivation.controller";

const router = Router();

router.get(
  "/integration-activation/scopes/session-test",
  testIntegrationActivationMerchantSession
);

router.get("/integration-activation/activate", activateIntegration);

export default router;