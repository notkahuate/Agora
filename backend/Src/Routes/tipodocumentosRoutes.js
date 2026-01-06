// routes/tiposDocumentos.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../Controllers/TipodocController.js");
const { authenticate, authorize } = require('../milddlewares/authMiddleware');

// 📌 CRUD básico
router.get("/", authenticate, authorize('super_admin', 'auditor'), controller.getAll);
router.get("/:id", authenticate, authorize('super_admin', 'auditor'), controller.getById);
router.post("/", authenticate, authorize('super_admin'), controller.create);
router.put("/:id", authenticate, authorize('super_admin'), controller.update);
router.delete("/:id", authenticate, authorize('super_admin'), controller.delete);

module.exports = router;
