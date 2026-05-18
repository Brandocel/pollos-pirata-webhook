import { Router } from "express";
import {
  activateIntegration,
  testIntegrationActivationMerchantSession,
} from "../controllers/uberIntegrationActivation.controller";

const router = Router();

router.get(
  "/integration-activation/scopes/session-test",
  testIntegrationActivationMerchantSession
);

router.post(
  "/integration-activation/stores/:storeId/activate",
  activateIntegration
);

export default router;