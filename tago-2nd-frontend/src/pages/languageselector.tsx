import React, { useState } from "react";
import logo from "../assets/logo.png";
import vector21 from "../assets/vector21.png";
import hometagoBit from "../assets/hometagoBit.png";
import vector23 from "../assets/Vector23.png";
import vector19 from "../assets/Vector19.png";
import vector20 from "../assets/Vector20.png";
import vector17 from "../assets/Vector17.png";
import vector18 from "../assets/Vector18.png";
import { useNavigate } from "react-router-dom";

const languages = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "es-ES", name: "Spanish" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "it-IT", name: "Italian" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ja-JP", name: "Japanese" },
  { code: "ko-KR", name: "Korean" },
  { code: "ru-RU", name: "Russian" },
  { code: "hi-IN", name: "Hindi" },
  { code: "ar-SA", name: "Arabic" },
  // Add more as needed
];

const LanguageSelector: React.FC = () => {
  const [selected, setSelected] = useState("");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex">
      {/* Left column with blue background */}
      <div className="hidden md:flex w-1/2 h-screen bg-[#1E60B6] relative items-center justify-center">
        {/* Top left corner vector23 attached to the div corner */}
        <img
          src={vector23}
          alt="Vector 23"
          className="absolute left-4 top-4 w-16 h-16 z-20 -translate-x-[30%] -translate-y-[30%]"
        />
        {/* Top right corner vector19 and vector20 */}
        <img
          src={vector19}
          alt="Vector 19"
          className="absolute right-10 top-4 w-20 h-20 z-20 -translate-y-1/3 translate-x-1/3 rotate-12"
        />
        <img
          src={vector20}
          alt="Vector 20"
          className="absolute right-0 top-0 w-20 h-20 z-10 -translate-y-[20%] translate-x-[20%]"
        />
        <img
          src={vector21}
          alt="Vector"
          className="absolute left-0 top-1/2 -translate-y-1/2 max-w-[90%] max-h-[90%]"
        />
        {/* Centered hometagoBit image */}
        <img
          src={hometagoBit}
          alt="Home TagoBit"
          className="z-10 max-w-[80%] max-h-[80%] object-contain"
        />
        <img
          src={logo}
          className="max-w-[5%] max-h-[5%] object-contain absolute left-30 top-38 transform z-20"
        />
        {/* Bottom center vector17 and vector18 */}
        <img
          src={vector17}
          alt="Vector 17"
          className="absolute left-1/2 bottom-8 w-48 h-16 z-20 -translate-x-1/2 translate-y-1/2"
        />
        <img
          src={vector18}
          alt="Vector 18"
          className="absolute left-85 bottom-15 w-48 h-16 z-30 -translate-x-1/2 translate-y-full"
        />
      </div>
      {/* Right column with language selector */}
      <div className="w-full md:w-1/2 flex flex-col items-center px-4 py-8 relative bg-white min-h-screen justify-between">
        <div className="w-full flex flex-col items-center">
          <img src={logo} alt="Logo" className="w-32 h-32 mt-8 mb-8" />
          <h2 className="text-2xl font-Poppins text-[#1A5AC7] mb-10 text-center">
            Welcome!
          </h2>
          <div className="w-full mb-10 relative">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-base focus:outline-none focus:ring-2 focus:ring-[#1A5AC7] text-gray-700 appearance-none pr-10"
            >
              <option value="" disabled>
                Select your language
              </option>
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
            {/* Arrow down icon */}
            <span className="pointer-events-none absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
                <path
                  d="M6 8l4 4 4-4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
          <button
            disabled={!selected}
            onClick={async () => {
              if (selected) {
                localStorage.setItem("listenerLanguage", selected);
                // Update language in DB if user is logged in
                const token = localStorage.getItem("token");
                if (token) {
                  try {
                    const res = await fetch("http://localhost:3000/api/v1/auth/update-profile", {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                      },
                      body: JSON.stringify({ language: selected })
                    });
                    const data = await res.json();
                    console.log('LANGUAGE DEBUG: Backend response:', data);
                    if (data.user) {
                      // Update local user data so Helpers.getUserLanguage() works
                      localStorage.setItem("userData", JSON.stringify(data.user));
                      console.log('LANGUAGE DEBUG: userData in localStorage:', localStorage.getItem("userData"));
                    }
                  } catch (err) {
                    console.error('LANGUAGE DEBUG: Error updating language', err);
                  }
                }
                navigate("/joinpage");
              }
            }}
            className={`w-full py-3 rounded-lg font-semibold text-lg transition-colors duration-200 mb-8 ${
              selected
                ? "bg-[#1A5AC7] text-white hover:bg-blue-700 cursor-pointer"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            Join
          </button>
        </div>
        <div className="w-full text-center text-gray-400 text-sm tracking-wide mb-4">
          <span className="mr-1">🔒</span>{" "}
          <span>audio-translator.tagobit.com</span>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
