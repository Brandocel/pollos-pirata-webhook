import { Router } from "express";
import {
  getReportFile,
  testReportScope
} from "../controllers/uberReports.controller";

const router = Router();

router.get("/reports/scopes/test", testReportScope);
router.post("/reports/files", getReportFile);

export default router;