import { Router } from "express";
import {
  registerUser,
  loginUser,
  verifyEmail,
  forgetPassword,
  resetPassword,
  resendOtp,
  updateProfile,
  getUserProfile,
  updateUserStatus,
} from "../controllers/authController";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

// Register a new user
router.post("/register", registerUser);

// Login a user
router.post("/login", loginUser);

router.post("/resend-verification", resendOtp);

// Verify email
router.post("/verify-email", verifyEmail);

// Forget Password
router.post("/forget-password", forgetPassword);

// Reset Password
router.post("/reset-password", resetPassword);

// Update user profile (protected route)
router.patch("/update-profile", authMiddleware, updateProfile);

// Get user profile (protected route)
router.get("/profile", authMiddleware, getUserProfile);

// Update user status (protected route)
router.post("/status", authMiddleware, updateUserStatus);

export default router;
