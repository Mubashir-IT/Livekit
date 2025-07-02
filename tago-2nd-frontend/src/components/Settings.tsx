import { useState } from "react";
import { useNavigate } from "react-router-dom"; // For navigation after logout
import {
  User,
  Bell,
  Video,
  Globe,
  MessageCircle,
  LogOut,
  ChevronRight,
  MoreHorizontal,
  CheckCircle,
} from "lucide-react";
import image from "@/assets/image.png";
import Helpers from "@/config/helpers";

const Settings = () => {
  const navigate = useNavigate();

  // Get user data from localStorage
  const user = Helpers.getUserData();
  const userName = user?.fullName || user?.name || "User";
  const userEmail = user?.email || "user@email.com";
  const [status] = useState(user?.status || "Online");
  const [language] = useState(user?.language || "English (US)");

  const settingsItems = [
    {
      icon: User,
      label: "Set Status",
      value: status,
      hasDropdown: true,
      showStatusIndicator: true,
    },
    {
      icon: Bell,
      label: "Notification",
      hasArrow: true,
    },
    {
      icon: Video,
      label: "Sessions",
      hasArrow: true,
    },
    {
      icon: Globe,
      label: "Language",
      value: language,
      hasArrow: true,
    },
    {
      icon: MessageCircle,
      label: "Chats",
      hasArrow: true,
    },
  ];

  //  Logout handler
  const handleLogout = () => {
    localStorage.clear(); // Clear all localStorage (or use removeItem if needed)
    navigate("/login"); // Redirect to login page (adjust route as needed)
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-100">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">
            Settings
          </h1>
          <p className="text-sm text-gray-500">Settings</p>
        </div>

        {/* User Profile Section */}
        <div className="px-6 py-6 border-b ml-2 mr-6 border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center overflow-hidden">
                  <img
                    src={image}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 text-lg">
                  {userName}
                </h2>
                <p className="text-gray-500 text-sm">{userEmail}</p>
              </div>
            </div>
            <button className="p-2 text-gray-400 hover:text-gray-600">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Settings Items */}
        <div className="py-4 pl-6 pr-6">
          {settingsItems.map((item, index) => {
            const IconComponent = item.icon;
            return (
              <div
                key={index}
                className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors duration-150"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-6 h-6 text-gray-600">
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <span className="text-gray-900 font-medium">
                      {item.label}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    {item.showStatusIndicator && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-700 text-sm">
                          {item.value}
                        </span>
                      </div>
                    )}

                    {item.value && !item.showStatusIndicator && (
                      <span className="text-gray-500 text-sm">
                        {item.value}
                      </span>
                    )}

                    {item.hasArrow && (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}

                    {item.hasDropdown && (
                      <ChevronRight className="w-5 h-5 text-gray-400 transform rotate-90" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Log Out Section */}
        <div className="pl-6 pr-6 mt-8 border-t border-gray-100">
          <div
            onClick={handleLogout}
            className="flex items-center space-x-4 text-red-600 cursor-pointer hover:bg-red-50 -mx-2 px-2 py-2 rounded-lg transition-colors duration-150"
          >
            <LogOut className="w-6 h-6" />
            <span className="font-medium">Log Out</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
