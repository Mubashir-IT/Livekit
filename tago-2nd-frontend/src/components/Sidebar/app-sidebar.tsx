import {  Settings,  Home, Menu } from "lucide-react";
import LogoImage from "@/assets/logo.png";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  const isActiveRoute = (path: string) => location.pathname === path;

  // Close sidebar on overlay click (mobile)
  const handleOverlayClick = () => setIsOpen(false);

  // Open sidebar with hamburger
  const handleHamburgerClick = () => setIsOpen(true);

  return (
    <>
      {/* Hamburger for mobile, hidden on md and up  */}
      {!isOpen && (
        <button
          className="fixed top-4 left-4 z-50 md:hidden bg-white rounded-full p-2 shadow border border-gray-200"
          onClick={handleHamburgerClick}
          aria-label="Open sidebar"
          style={{ zIndex: 60 }}
        >
          <Menu className="w-6 h-6 text-gray-700" />
        </button>
      )}
      {/* Spacer to prevent logo overlap, hidden on md and up */}
      <div className="h- md:hidden" />
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 rounded-tl-2xl flex flex-col items-start shadow-md z-50 transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <section className="w-full flex justify-center items-center pt-2 pb-4 select-none">
          <img
            src={LogoImage}
            alt="TagoBit Logo"
            className="h-35 max-w-[200px] object-contain"
          />
        </section>
        {/* Navigation */}
        <nav className="flex flex-col w-full mt-2">
          {/* Home */}
          <button
            className={cn(
              "flex items-center gap-3 px-6 py-3 rounded-lg font-medium text-base transition-all w-[90%] mx-auto mb-8",
              isActiveRoute("/")
                ? "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow"
                : "text-gray-400 hover:bg-gray-50"
            )}
            onClick={() => {
              navigate("/");
              setIsOpen(false);
            }}
          >
            <Home
              className={cn(
                "w-5 h-5",
                isActiveRoute("/") ? "text-white" : "text-gray-400"
              )}
            />
            Home
          </button>
          {/* Settings */}
          <button
            className={cn(
              "flex items-center gap-3 px-6 py-3 rounded-lg font-medium text-base w-[90%] mx-auto",
              isActiveRoute("/settings")
                ? "bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow"
                : "text-gray-400 hover:bg-gray-50"
            )}
            onClick={() => {
              navigate("/settings");
              setIsOpen(false);
            }}
          >
            <Settings
              className={cn(
                "w-5 h-5",
                isActiveRoute("/settings") ? "text-white" : "text-gray-400"
              )}
            />
            Settings
          </button>
        </nav>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 transition-opacity duration-300 md:hidden z-40"
          onClick={handleOverlayClick}
        />
      )}
    </>
  );
}
