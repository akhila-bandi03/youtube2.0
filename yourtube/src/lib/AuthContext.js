import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { useState, useEffect, createContext, useContext } from "react";
import { provider, auth } from "./firebase";
import axiosInstance from "./axiosinstance";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

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

  const [theme, setTheme] = useState("dark");

  const getISTDefaultTheme = () => {
    const d = new Date();
    // Convert to IST (UTC + 5:30)
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const hour = ist.getHours();
    return hour >= 10 && hour < 12 ? "light" : "dark";
  };

  // Sync theme class with document root
  useEffect(() => {
    const activeTheme = user?.theme || getISTDefaultTheme();
    setTheme(activeTheme);
  }, [user]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(theme);
    }
  }, [theme]);

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

  const togglePlan = async () => {
    if (!user) return;
    // Cycle through all plan tiers so every limit can be tested
    const planOrder = ["free", "bronze", "silver", "gold"];
    const currentIdx = planOrder.indexOf(user.plan || "free");
    const nextPlan = planOrder[(currentIdx + 1) % planOrder.length];

    const updatedUser = { ...user, plan: nextPlan };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));

    // Persist plan change to database
    try {
      await axiosInstance.patch(`/user/plan/${user._id}`, { plan: nextPlan });
    } catch (err) {
      console.error("Failed to save plan to DB:", err);
      // Still update locally so testing continues
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

  const processLogin = async (payload) => {
    // 1. Get approximate IP location
    let location = "Hyderabad, IN";
    try {
      const geoRes = await fetch("https://ipapi.co/json/");
      const geoData = await geoRes.json();
      if (geoData.city && geoData.region) {
        location = `${geoData.city}, ${geoData.region}`;
      }
    } catch (e) {
      console.log("Geo lookup failed, using default fallback location", e);
    }

    // 2. Identify device user-agent
    const device = navigator.userAgent;
    const loginPayload = { ...payload, location, device };

    try {
      const response = await axiosInstance.post("/user/login", loginPayload);
      const data = response.data;

      if (data.requiresOtp) {
        // Show OTP dialog prompt
        const otpCode = prompt(
          `${data.message}\n\nA security code has been sent to your registered email address.`
        );

        if (!otpCode) {
          alert("Verification is required to proceed.");
          return;
        }

        const verifyRes = await axiosInstance.post("/user/verify-otp", {
          userId: data.userId,
          otpCode,
          location,
          device
        });

        if (verifyRes.data.success) {
          login(verifyRes.data.result);
          alert("Security verification successful. Welcome back!");
        }
      } else {
        login(data.result);
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Login verification failed.");
    }
  };

  const handlegooglesignin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const firebaseuser = result.user;
      const payload = {
        email: firebaseuser.email,
        name: firebaseuser.displayName,
        image: firebaseuser.photoURL || "https://github.com/shadcn.png",
      };
      await processLogin(payload);
    } catch (error) {
      console.error("Firebase auth failed, falling back to mock session:", error);
      const mockUserPayload = {
        email: "testuser@elevance.com",
        name: "Bandi Parshamulu",
        image: "https://github.com/shadcn.png"
      };
      await processLogin(mockUserPayload);
    }
  };

  useEffect(() => {
    const unsubcribe = onAuthStateChanged(auth, async (firebaseuser) => {
      if (firebaseuser) {
        try {
          const payload = {
            email: firebaseuser.email,
            name: firebaseuser.displayName,
            image: firebaseuser.photoURL || "https://github.com/shadcn.png",
          };
          await processLogin(payload);
        } catch (error) {
          console.error(error);
          logout();
        }
      }
    });
    return () => unsubcribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, login, logout, handlegooglesignin, togglePlan, theme, toggleTheme }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
