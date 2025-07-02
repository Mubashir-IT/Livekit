import React, {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  type ChangeEvent,
} from "react";
import { ArrowLeft } from "lucide-react";
import Helpers from "@/config/helpers";
import { useLocation, useNavigate } from "react-router-dom";

interface EmailVerificationProps {
  email?: string;
  onVerify?: (otp: string) => void;
  onResend?: () => void;
  onGoBack?: () => void;
  countdownDuration?: number;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({
  email = "demo@gmail.com",
  onVerify,
  onResend,
  onGoBack,
  countdownDuration = 30,
}) => {
  const location=useLocation();
   const queryParams = new URLSearchParams(location.search); // Get query params from the URL

  const queryEmail = queryParams.get('email'); // Retrieve the 'email' query parameter
  console.log("email",queryEmail);

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState<number>(countdownDuration);
  const [canResend, setCanResend] = useState<boolean>(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
const [message, setMessage] = useState<{ text: string; type: "success" | "error" | null }>({ text: "", type: null });
  const navigate = useNavigate(); // <-- add this line
 

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleInputChange = (index: number, value: string): void => {
    // Only allow single digit
    if (value.length > 1) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: KeyboardEvent<HTMLInputElement>
  ): void => {
    // Handle backspace
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>): void => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    const newOtp = [...otp];

    for (let i = 0; i < pastedData.length && i < 6; i++) {
      if (/^\d$/.test(pastedData[i])) {
        newOtp[i] = pastedData[i];
      }
    }

    setOtp(newOtp);

    // Focus the next empty input or the last input
    const nextEmptyIndex = newOtp.findIndex((digit) => digit === "");
    const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
    inputRefs.current[focusIndex]?.focus();
  };

 const handleVerify = async () => {
  const otpString = otp.join("");
  if (otpString.length === 6) {
    try {
     

      // Make an API call to verify the OTP
      const response = await fetch(`${Helpers.baseUrl}/api/v1/auth/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: otpString,  // Send the OTP as the token
          email: queryEmail,      // Send the email for verification
        }),

      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ text: "Email verified successfully", type: "success" });
        // Optionally, redirect or perform further actions
        localStorage.setItem("user", JSON.stringify(data.user || data.token || data));
        navigate("/"); // Redirect to dashboard or another page
      } else {
        setMessage({ text: data.message, type: "error" });
      }
    } catch (error) {
      console.error("Error during OTP verification:", error);
      setMessage({ text: "Failed to verify. Please try again.", type: "error" });
    }
  } else {
    alert("Please enter all 6 digits");
  }
};


  const handleResend = async (): Promise<void> => {
    if (canResend) {
      setCountdown(countdownDuration);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
      try {
        const response = await fetch(`${Helpers.baseUrl}/api/v1/auth/resend-verification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: queryEmail }),
        });
        const data = await response.json();
        if (response.ok) {
          setMessage({ text: "Verification code resent to your email.", type: "success" });
        } else {
          setMessage({ text: data.message || "Failed to resend code.", type: "error" });
        }
      } catch (error) {
        setMessage({ text: "Failed to resend code. Please try again.", type: "error" });
      }
      onResend?.();
    }
  };

  const handleGoBack = (): void => {
    console.log("Going back");
    onGoBack?.();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={handleGoBack}
          className="mb-6 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
          type="button"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">
            Almost there
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed">
            Please enter the 6-digit code sent to your email{" "}
            <span className="text-blue-600 font-medium">{queryEmail}</span> for
            verification.
          </p>
        </div>

        {/* OTP Input Fields */}
        <div className="flex justify-center gap-3 mb-8">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              value={digit}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                handleInputChange(index, e.target.value)
              }
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                handleKeyDown(index, e)
              }
              onPaste={handlePaste}
              className="w-12 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-gray-50"
              maxLength={1}
              inputMode="numeric"
              pattern="[0-9]"
              autoComplete="one-time-code"
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition duration-200 font-medium mb-6"
          type="button"
        >
          Verify
        </button>

        {/* Resend Section */}
        <div className="text-center">
          <p className="text-gray-600 text-sm mb-2">
            Didn't receive any code?{" "}
            <button
              onClick={handleResend}
              className={`font-medium transition duration-200 ${
                canResend
                  ? "text-blue-600 hover:text-blue-800 cursor-pointer"
                  : "text-gray-400 cursor-not-allowed"
              }`}
              disabled={!canResend}
              type="button"
            >
              Resend Again
            </button>
          </p>
          {!canResend && (
            <p className="text-gray-500 text-sm">
              Request new code in {formatTime(countdown)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
