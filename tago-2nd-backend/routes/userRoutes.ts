import { Router } from "express";
import multer from "multer";
import path from "path";
import { uploadProfileImage } from "../controllers/authController";
import authMiddleware from "../middlewares/authMiddleware";

const router = Router();

// Multer config for uploads folder
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

// POST /api/v1/user/upload-image
router.post("/upload-image", authMiddleware, upload.single("image"), uploadProfileImage);

export default router;
