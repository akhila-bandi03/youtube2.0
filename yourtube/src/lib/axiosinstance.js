import axios from "axios";

export const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // Localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000";
    }
    // Check if hostname is an IP address (IPv4)
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(hostname)) {
      return `http://${hostname}:5000`;
    }
    // Fallback/Vercel: use environment variable or the dynamic domain
    return process.env.NEXT_PUBLIC_BACKEND_URL || `http://${hostname}:5000`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
};

const axiosInstance = axios.create({
  baseURL: getBackendUrl(),
});

// Dynamic interceptor to ensure requests always resolve correctly on dynamic hostnames
axiosInstance.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  config.headers["bypass-tunnel-reminder"] = "true";
  return config;
});

export default axiosInstance;
