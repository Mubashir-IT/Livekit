import { IsEmail, IsNotEmpty, MinLength, Length, validate } from 'class-validator';
import { validateDto } from '../../config/helpers';

// Reusable function to handle validation and error formatting


// Login DTO
export class LogInDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email field is required' })
  email!: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsNotEmpty({ message: 'Password field is required' })
  password!: string;
};

export const validateLogin = async (loginData: any) => {
  const loginDto = new LogInDto();
  loginDto.email = loginData.email;
  loginDto.password = loginData.password;
  return await validateDto(loginDto);
};

// Email Verification DTO
export class ValidateVerifyEmailDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email field is required' })
  email!: string;

  @IsNotEmpty({ message: 'Token field is required' })
  @Length(6, 6, { message: 'Token must consist of 6 characters' })
  token!: string;
};

export const validateVerificationEmail = async (verificationData: any) => {
  const verificationDto = new ValidateVerifyEmailDto();
  verificationDto.email = verificationData.email;
  verificationDto.token = verificationData.token;
  return await validateDto(verificationDto);
};

// Generic Email DTO
export class EmailDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email field is required' })
  email!: string;


};

export const validateEmail = async (emailData: any) => {
  const emailVerificationDto = new EmailDto();
  emailVerificationDto.email = emailData.email;
  return await validateDto(emailVerificationDto);
};

// Reset Password DTO
export class ResetPasswordDto {
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email field is required' })
  email!: string;

  @Length(6, 6, { message: 'Token must consist of 6 characters' })
  @IsNotEmpty({ message: 'Token field is required' })
  token!: string;

  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsNotEmpty({ message: 'Password field is required' })
  newPassword!: string;
};

export const validateResetPassword = async (resetPasswordData: any) => {
  const resetPasswordDto = new ResetPasswordDto();
  resetPasswordDto.email = resetPasswordData.email;
  resetPasswordDto.token = resetPasswordData.token;
  resetPasswordDto.newPassword = resetPasswordData.newPassword;
  return await validateDto(resetPasswordDto);
};
