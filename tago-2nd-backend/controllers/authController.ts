import { Request, Response } from "express";
import { User } from "../config/database";

import bcrypt from "bcrypt";
import {
  validateEmail,
  validateLogin,
  validateResetPassword,
  validateVerificationEmail,
} from "../models/validator/auth.validator";
import {
  customErrorReponse,
  generateOtp,
  handleEmailSend,
  isCustomError,
  userDataFormat,
  userTokenGenerate,
} from "../config/helpers";
import path from "path";

// Register User
export const registerUser = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { name, email, password, phoneNo, language } = req.body;
    await User.validateUser({ name, email, password, phoneNo }); // You can add any specific validator for the registration process if needed.

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

      const otp = generateOtp();
    const user = await User.create({
      name,
      email,
      password,
      status: "offline",
      otp,
      phoneNo,
      language: language || "en-US",
    });

    const sendUserReponse = userDataFormat(user);
    const token = await userTokenGenerate(user);

    await handleEmailSend(
      email,
      otp,
      "sendOtp",
      "Verify your email address"
    );

    res.status(201).json({
      success: true,
      message: "User registered. Please verify your email.",
      user: sendUserReponse,
      token,
    });
  } catch (error: any) {
    if (isCustomError(error)) {
      return customErrorReponse(error, res);
    }

    res.status(500).json({ success: false, message: error.message });
  }
};

// Login User
export const loginUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;
    await validateLogin({ email, password });

    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    if (user.otp) {
      const verificationUrl =
        process.env.REDIRECT_URL?.trim()
          ? `${process.env.REDIRECT_URL}?email=${user.email}`
          : `http://localhost:5173/verification?email=${user.email}`;

      return res.status(400).json({
        success: false,
        message: "Please verify your email first",
        redirectUrl: verificationUrl,
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const token = await userTokenGenerate(user);
    const sendUserReponse = userDataFormat(user);

    return res.status(200).json({ success: true, user: sendUserReponse, token });
  } catch (error: any) {
    if (isCustomError(error)) {
      return customErrorReponse(error, res);
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};


// Verify Email
export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { token, email } = req.body;
    await validateVerificationEmail({ email, token });

    const user = await User.findOne({
      where: { otp: token, email },
    });
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid token or User not exist " });
    }

    if (user.verifiedAt !== null) {
      return res.status(400).json({
        success: false,
        message: "You have already verified your email",
      });
    }

    user.otp = null;
    user.verifiedAt = new Date();
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Email verified successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Resend OTP
export const resendOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;
    await validateEmail({ email });

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found" });
    }

    const newOtp = generateOtp();
    user.otp = newOtp;
    await user.save();

    await handleEmailSend(
      email,
      newOtp,
      "sendOtp",
      "Verify your email address"
    );

    res
      .status(200)
      .json({ success: true, message: "OTP sent successfully", user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Forget Password
export const forgetPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email } = req.body;
    await validateEmail({ email });

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

    const resetToken = generateOtp();
    user.otp = resetToken;
    await user.save();

    await handleEmailSend(email, resetToken, "sendOtp", "Reset Your Password");

    res
      .status(200)
      .json({ success: true, message: "Reset token sent to your email" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Reset Password
export const resetPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, token, newPassword } = req.body;
    await validateResetPassword({ email, token, newPassword });

    const user = await User.findOne({
      where: { email, otp: token },
    });
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid token or email" });
    }

    user.password = newPassword;
    user.otp = null;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password reset successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update User Profile
export const updateProfile = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { language } = req.body;

    // Validate language is one of the supported languages
    if (
      language &&
      ![
        "en-US",
        "en-GB",
        "es-ES",
        "fr-FR",
        "de-DE",
        "it-IT",
        "pt-BR",
        "zh-CN",
        "ja-JP",
        "ko-KR",
        "ru-RU",
        "hi-IN",
        "ar-SA",
      ].includes(language)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid language code",
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update only the language field
    if (language) {
      user.language = language;
    }

    await user.save();

    // Return the updated user data
    const updatedUserData = userDataFormat(user);

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUserData,
    });
  } catch (error: any) {
    if (isCustomError(error)) {
      return customErrorReponse(error, res);
    }
    res.status(500).json({
      success: false,
      message: error.message || "An error occurred while updating the profile",
    });
  }
};

// Get User Profile
export const getUserProfile = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const userData = userDataFormat(user);
    res.status(200).json({ success: true, user: userData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update User Status
export const updateUserStatus = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Authentication required" });
    }
    const { status } = req.body;
    if (!status || !["online", "offline"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value" });
    }
    const user = await User.findByPk(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    user.status = status;
    await user.save();
    res.status(200).json({ success: true, message: "Status updated", status });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upload Profile Image
export const uploadProfileImage = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file uploaded" });
    }
    // Save file path in DB (relative to /uploads)
    const imageUrl = `/uploads/${req.file.filename}`;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    user.imageUrl = imageUrl;
    await user.save();
    res.status(200).json({ success: true, imageUrl });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
