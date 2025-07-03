import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import axios from "axios";
import SideImage from "@/assets/signin_image.svg";
import Helpers from "@/config/helpers";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      navigate("/");
    }
  }, []);
  const handleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const response = await axios.post(
        `${Helpers.apiUrl}auth/login`,
        { email, password },
        Helpers.authHeaders
      );

      console.log("response.data", response.data);
      if (!response.data.success) {
        console.log("response.data.redirectUrl", response.data.redirectUrl);

        if (response.data.redirectUrl) {
          window.location.href = response.data.redirectUrl;
          return;
        }

        Helpers.toast("error", response.data.message || "Login failed");
        setIsSubmitting(false);
        return;
      }
      
      const { token, user } = response.data;
      const enrichedUser = {
        ...user,
        language: user.language || Helpers.defaultLanguage,
      };

      Helpers.saveUserLocal({ token, user: enrichedUser });
      toast("success  User Logged In Successfully");
      localStorage.setItem("isAuthenticated", status ? "true" : "false");
      // Set user status to online in DB
      await fetch(`${Helpers.apiUrl}auth/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "online" }),
      });
      // Update local user status for UI
      const updatedUser = { ...enrichedUser, status: "online" };
      Helpers.saveUserLocal({ token, user: updatedUser });
      // navigate("/");
      onLogin();
    } catch (error: any) {
      console.log("response.data.redirectUrl", error.response?.data?.redirectUrl);
      // window.location.href = error.response?.data?.redirectUrl || "/login";

      Helpers.toast("error", error?.response?.data?.message || "Login failed");
      // Optional: setBackendErrors(setError, error.response?.data?.errors);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center">
        <img src={SideImage} alt="Sign In Illustration" className="max-w-md" />
      </div>

      {/* Right Column - Sign In Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back
            </h1>
            <p className="text-gray-600">Sign in to access your account</p>
          </div>

          <div className="space-y-6">
            {/* Email */}
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-4 py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                required
              />
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>

            {/* Password */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 pl-12 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                required
              />
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-600">Remember me</span>
              </label>
              <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
                Forget password ?
              </a>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition font-medium"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>

            {/* Register */}
            <p className="text-center text-sm text-gray-600">
              New Member?{" "}
              <Link
                to="/signup"
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                Register now
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
