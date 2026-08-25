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
    // Fallback/Vercel: use the stable localtunnel URL
    return process.env.NEXT_PUBLIC_BACKEND_URL || "https://youtube-api-backend-v2.loca.lt";
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || "https://youtube-api-backend-v2.loca.lt";
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
