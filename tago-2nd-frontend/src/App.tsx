import {
  BrowserRouter as Router,
  Route,
  Navigate,
  Routes,
  useNavigate,
} from "react-router-dom";
import { use, useState } from "react";
import Login from "@/pages/Login";
import Settings from "@/components/Settings";
import SignUp from "@/pages/SingUp";
import Dashboard from "@/components/Dashboard";
import EmailVerified from "@/pages/verification";
import { Layout } from "@/components/Sidebar/layout";
import { Toaster } from "sonner";
import LanguageSelector from "@/pages/languageselector";
import JoinPage from "./pages/joinpage";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("isAuthenticated") === "true"
  );

  const navigate = useNavigate();

  // Add useEffect to sync subscription status with localStorage

  const handleAuthentication = (status: boolean) => {
    setIsAuthenticated(status);
    // Sync with localStorage
    navigate("/");
    localStorage.setItem("isAuthenticated", status ? "true" : "false");
  };

  return (
  
      <>
      
      <Toaster />
      <Routes>
        {/* Public routes that don't require authentication check */}
        <Route path="/signup" element={<SignUp />} />

        <Route
          path="/login"
          element={<Login onLogin={() => handleAuthentication(true)} />}
        />

        <Route path="/verify-email" element={<EmailVerified />} />
        {/* <Route path="/language-selector" element={<LanguageSelector />} /> */}
        <Route path="/languageselector" element={<LanguageSelector />} />
        <Route path="/joinpage" element={<JoinPage />} />

        {isAuthenticated ? (
          <>
            <Route
              path="/"
              element={
                <Layout>
                  <Dashboard />
                </Layout>
              }
            />
            <Route
              path="/settings"
              element={
                <Layout>
                  <Settings />
                </Layout>
              }
            />
          </>
        ) : (
          <>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>

      </>
    
  );
}

export default App;
