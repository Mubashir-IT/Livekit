import dotenv from "dotenv";

import { validate } from "class-validator";
import nodemailer from "nodemailer";
import EmailTemplates from "../utils/EmailTemplates";
import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

// Extend the Request interface to include the 'user' property
declare global {
  namespace Express {
    interface Request {
      user?: any;
      roomName?: string;
      participantName?: string;
    }
  }
}
import jwt from "jsonwebtoken";
dotenv.config();

// Reusable function to handle validation and error formatting
export const validateAndFormatError = async (dto: any): Promise<any> => {
  const errors = await validate(dto);

  if (errors.length > 0) {
    const formattedErrors: Record<string, string[]> = {};

    errors.forEach((error) => {
      const key = error.property;
      console.log("--- start ---");
      console.log(error.constraints);
      console.log("--- end ---");
      const messages = Object.values(error.constraints || {});

      console.log("--- messages start ---");
      console.log(messages);
      console.log("--- messages end ---");
      if (formattedErrors[key]) {
        formattedErrors[key].push(...messages[0]);
      } else {
        formattedErrors[key] = [messages[0]];
      }
    });
    return formattedErrors;
  }
};
export const userTokenGenerate = async (user: any) => {
  const token = await jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      language: user.language || "en-US",
    },
    process.env.JWT_SECRET || "secret"
    // { expiresIn: "1h" }
  );

  return token;
};
export const userDataFormat = (user: any) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phoneNo: user.phoneNo,
    language: user.language || "en-US",
    isAdmin: user.isAdmin,
    verifiedAt: user.verifiedAt,
    status: user.status,
  };
};
export const isCustomError = (error: any): Boolean => {
  const isCustom = error instanceof CustomError;
  return isCustom;
};
export const customErrorReponse = async (error: any, res: Response) => {
  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.details, // Include validation errors in the response
    });
  }
};
export class CustomError extends Error {
  public statusCode: number;
  public details: Record<string, string[]>;

  constructor(
    message: string,
    statusCode: number,
    details: Record<string, string[]> = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    console.log("this.details", this.details);
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}
export const validateDto = async (dto: any): Promise<boolean> => {
  const errors = await validate(dto);

  if (errors.length > 0) {
    const formattedErrors: Record<string, string[]> = {};

    errors.forEach((error) => {
      const key = error.property;

      const messages = Object.values(error.constraints || {});

      if (formattedErrors[key]) {
        formattedErrors[key].push(...messages[0]);
      } else {
        formattedErrors[key] = [messages[0]];
      }
    });
    // Send JSON response with status and errors

    // return false;
    // throw new Error(JSON.stringify(formattedErrors));
    throw new CustomError("Validation failed", 400, formattedErrors);

    // return false;
  }

  return true;
};

export const createSecretKey = crypto.randomBytes(30).toString("hex");

// Reusable OTP generation function
export const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "",
  port: parseInt(process.env.MAIL_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.MAIL_USERNAME || "",
    pass: process.env.MAIL_PASSWORD || "",
  },
} as nodemailer.TransportOptions);

export const sendOtpEmail = async (
  email: string,
  emailTemplate: string,
  subject: string
) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM_ADDRESS,
    to: email,
    subject: subject,
    html: emailTemplate,
  });
};

// Common function to handle email sending logic
export const handleEmailSend = async (
  email: string,
  otp: string,
  templateName: string,
  subject: string
) => {
  try {
    const emailTemplate: string = await EmailTemplates.loadTemplate(
      templateName,
      {
        otpCode: otp,
        year: String(new Date().getFullYear()),
      }
    );

    await sendOtpEmail(email, emailTemplate, subject);
  } catch (emailError: any) {
    console.error("Email sending failed", emailError);
  }
};
