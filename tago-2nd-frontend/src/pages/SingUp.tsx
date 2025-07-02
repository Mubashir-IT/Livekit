import { useState } from "react";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Helpers from "@/config/helpers";

export default function SignUpUI() {
  const navigator = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    language: "English",
    phoneNumber: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  //  Inline feedback state
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | null;
  }>({ text: "", type: null });

  const languages = [
    "English",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
  ];

  const handleInputChange = (field: any, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

    const handleSignUp = async () => {
    if (!agreeToTerms) {
      setMessage({ text: "Please agree to the Terms and Conditions", type: "error" });
      return;
    }

    try {
      setMessage({ text: "Processing your request...", type: null });

      const requestData = {
        name: formData.fullName,
        email: formData.email,
        password: formData.password,
        phoneNo: formData.phoneNumber,
        language: formData.language,
      };

      const response = await fetch(`${Helpers.baseUrl}/api/v1/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });
      const data = await response.json();
console.log("resopnas",data)

      if (response.ok) {

        setMessage({ text: data.message, type: "success" });
        navigator(`/verify-email?email=${formData.email}`,{state: { email: formData.email }});
      } else {
        setMessage({ text: data.message, type: "error" });
      }
    } catch (err) {
      console.error("Error during signup:", err);
      setMessage({ text: "Signup failed. Please try again.", type: "error" });
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-100">
        <div className="max-w-md w-full">
          <div className="relative mb-8">
            <svg viewBox="0 0 400 300" className="w-full h-64">
              <path d="M50 60 L60 55 L70 60 M80 50 L90 45 L100 50 M120 55 L130 50 L140 55" stroke="#64748b" strokeWidth="2" fill="none" />
              <path d="M100 180 L140 120 L180 180 Z" fill="#3b82f6" />
              <path d="M160 180 L200 100 L240 180 Z" fill="#1e40af" />
              <circle cx="80" cy="180" r="25" fill="#e5e7eb" />
              <rect x="75" y="180" width="10" height="40" fill="#374151" />
              <path d="M50 220 Q150 200 250 180 Q300 170 350 160" stroke="#374151" strokeWidth="3" fill="none" />
              <ellipse cx="180" cy="190" rx="15" ry="8" fill="#374151" />
              <path d="M170 190 L190 190 L185 180 Z" fill="#374151" />
              <circle cx="120" cy="250" r="8" fill="#3b82f6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Right Column - Sign Up Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Get Started</h1>
            <p className="text-gray-600">By creating a free account.</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
                placeholder="Full name"
                className="w-full px-4 py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-900 placeholder-gray-500"
                required
              />
              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>

            <div className="relative">
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="Valid email"
                className="w-full px-4 py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-900 placeholder-gray-500"
                required
              />
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="w-full px-4 py-3 pl-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-900 text-left flex items-center justify-between"
              >
                <span>{formData.language}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                    showLanguageDropdown ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showLanguageDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                  {languages.map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => {
                        handleInputChange("language", language);
                        setShowLanguageDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 transition duration-200 text-gray-900 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {language}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                placeholder="Phone number"
                className="w-full px-4 py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-900 placeholder-gray-500"
                required
              />
              <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                placeholder="Strong Password"
                className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200 text-gray-900 placeholder-gray-500"
                required
              />
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition duration-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="flex items-start space-x-3 pt-2">
              <input
                type="checkbox"
                id="agreeToTerms"
                checked={agreeToTerms}
                onChange={(e) => setAgreeToTerms(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
              />
              <label htmlFor="agreeToTerms" className="text-sm text-gray-600 leading-relaxed">
                By checking the box you agree to our{" "}
                <a href="#" className="text-blue-600 hover:text-blue-800 transition duration-200">
                  Terms
                </a>{" "}
                and{" "}
                <a href="#" className="text-blue-600 hover:text-blue-800 transition duration-200">
                  Conditions
                </a>
                .
              </label>
            </div>

            <button
              onClick={handleSignUp}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition duration-200 font-medium mt-6"
            >
              Sign Up
            </button>

            {/* Inline message feedback */}
            {message.text && (
              <div className={`text-sm mt-2 ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                {message.text}
              </div>
            )}

              {/* Login Link */}
            <p className="text-center text-sm text-gray-600 mt-4">
              Already a member?{" "}
              <a href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                Log In
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
