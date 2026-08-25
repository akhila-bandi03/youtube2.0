import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";
import dynamic from "next/dynamic";

// Dynamically import OtpModal to avoid SSR issues
const OtpModal = dynamic(() => import("@/components/OtpModal"), { ssr: false });

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser]   = useState(null);
  const [theme, setTheme] = useState("dark");

  // OTP modal state — replaces browser prompt()
  const [otpState, setOtpState] = useState(null);
  // otpState shape: { message: string, userId: string, location: string, device: string }

  // ─── Restore user from localStorage on mount ───
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setUser({ plan: "free", ...parsed });
        } catch (e) {
          console.error("Failed to parse user from localStorage", e);
        }
      }
    }
  }, []);

  // ─── IST-based default theme: light 10am–12pm, dark otherwise ───
  const getISTDefaultTheme = () => {
    const d   = new Date();
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const hour = ist.getHours();
    return hour >= 10 && hour < 12 ? "light" : "dark";
  };

  // Sync theme from user profile (saved in DB) or IST default
  useEffect(() => {
    const activeTheme = (!user?.theme || user?.theme === "auto")
      ? getISTDefaultTheme()
      : user.theme;
    setTheme(activeTheme);
  }, [user]);

  // Apply theme class to <html> root
  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    }
  }, [theme]);

  // ─── Manual theme toggle — persists to DB ───
  const toggleTheme = async () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (user) {
      try {
        await axiosInstance.put("/user/theme", { userId: user._id, theme: nextTheme });
        const updated = { ...user, theme: nextTheme };
        setUser(updated);
        localStorage.setItem("user", JSON.stringify(updated));
      } catch (err) {
        console.error("Failed to save theme choice:", err);
      }
    }
  };

  const login = (userdata) => {
    const fullUser = { plan: "free", ...userdata };
    setUser(fullUser);
    localStorage.setItem("user", JSON.stringify(fullUser));
  };

  // ─── Plan cycling for dev testing ───
  const togglePlan = async () => {
    if (!user) return;
    const planOrder   = ["free", "bronze", "silver", "gold"];
    const currentIdx  = planOrder.indexOf(user.plan || "free");
    const nextPlan    = planOrder[(currentIdx + 1) % planOrder.length];

    const updatedUser = { ...user, plan: nextPlan };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));

    try {
      await axiosInstance.patch(`/user/plan/${user._id}`, { plan: nextPlan });
    } catch (err) {
      console.error("Failed to save plan to DB:", err);
    }

    alert(`Plan switched to ${nextPlan.toUpperCase()} (Downloads/day: free=1, bronze=3, silver=5, gold=50)`);
  };

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("user");
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error during sign out:", error);
    }
  };

  // ─── OTP verification via modal (replaces browser prompt) ───
  const showOtpModal = useCallback((message, userId, location, device) => {
    return new Promise((resolve, reject) => {
      setOtpState({
        message,
        onVerify: async (otpCode) => {
          setOtpState(null);
          try {
            const verifyRes = await axiosInstance.post("/user/verify-otp", {
              userId,
              otpCode,
              location,
              device,
            });
            if (verifyRes.data.success) {
              login(verifyRes.data.result);
              resolve(verifyRes.data.result);
            } else {
              reject(new Error("OTP verification failed"));
            }
          } catch (err) {
            reject(err);
          }
        },
        onCancel: () => {
          setOtpState(null);
          reject(new Error("Verification cancelled"));
        },
      });
    });
  }, []);

  // ─── Core login flow ───
  const processLogin = async (payload) => {
    // 1. Get approximate IP location
    let location = "Hyderabad, IN";
    try {
      const geoRes  = await fetch("https://ipapi.co/json/");
      const geoData = await geoRes.json();
      if (geoData.city && geoData.region) {
        location = `${geoData.city}, ${geoData.region}`;
      }
    } catch (e) {
      console.log("Geo lookup failed, using default fallback location", e);
    }

    const device       = navigator.userAgent;
    const loginPayload = { ...payload, location, device };

    try {
      const response = await axiosInstance.post("/user/login", loginPayload);
      const data     = response.data;

      if (data.requiresOtp) {
        // Show proper modal instead of browser prompt()
        try {
          await showOtpModal(
            data.message ||
              "A security code has been sent to your registered email address.",
            data.userId,
            location,
            device
          );
          // login() is called inside onVerify after successful verification
        } catch (otpErr) {
          if (otpErr?.message !== "Verification cancelled") {
            const msg = otpErr?.response?.data?.error || otpErr?.message || "OTP verification failed.";
            alert(`⚠️ ${msg}`);
          }
        }
      } else {
        login(data.result);
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Login verification failed.");
    }
  };

  // ─── Google Sign-In ───
  const handlegooglesignin = async () => {
    try {
      const result      = await signInWithPopup(auth, provider);
      const firebaseuser = result.user;
      const payload = {
        email: firebaseuser.email,
        name:  firebaseuser.displayName,
        image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      };
      await processLogin(payload);
    } catch (error) {
      console.error("Firebase auth failed, falling back to mock session:", error);
      const mockUserPayload = {
        email: "testuser@elevance.com",
        name:  "Bandi Parshamulu",
        image: "https://github.com/shadcn.png",
      };
      await processLogin(mockUserPayload);
    }
  };

  // ─── Firebase auth state listener ───
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseuser) => {
      if (firebaseuser) {
        try {
          const payload = {
            email: firebaseuser.email,
            name:  firebaseuser.displayName,
            image: firebaseuser.photoURL || "https://github.com/shadcn.png",
          };
          await processLogin(payload);
        } catch (error) {
          console.error(error);
          logout();
        }
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserContext.Provider
      value={{ user, login, logout, handlegooglesignin, togglePlan, theme, toggleTheme }}
    >
      {children}

      {/* OTP Modal — rendered here so it overlays the whole app */}
      {otpState && (
        <OtpModal
          message={otpState.message}
          onVerify={otpState.onVerify}
          onCancel={otpState.onCancel}
        />
      )}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
