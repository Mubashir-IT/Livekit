import { Router, Request, Response } from "express";
import authMiddleware from "../middlewares/authMiddleware";
import { translateText } from "../controllers/translateController";

const router = Router();

// Route for translating text - auth optional for development
router.post('/', (req, res, next) => {
  // Skip auth for development/testing
  // In production, you'd use: authMiddleware(req, res, next)
  next();
}, translateText);

export default router; 