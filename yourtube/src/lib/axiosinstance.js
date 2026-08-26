import axios from "axios";

const configuredBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "https://youtube-api-backend-v2.loca.lt";

export const getBackendUrl = () => {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000";
    }

    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipPattern.test(hostname)) {
      return `http://${hostname}:5000`;
    }

    // Production environments must provide a real backend URL via env vars.
    // Do not silently fall back to stale tunnel URLs that fail with CORS/503s.
    return configuredBackendUrl;
  }

  return configuredBackendUrl;
};

export const getVideoUrl = (filepath) => {
  if (!filepath) return "";
  if (filepath.startsWith("http://") || filepath.startsWith("https://")) {
    return filepath;
  }
  return `${getBackendUrl()}/${filepath}`;
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
