import axios from "axios";

const configuredBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:5000";

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

const axiosInstance = axios.create({
  baseURL: getBackendUrl(),
});

axiosInstance.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  config.headers["bypass-tunnel-reminder"] = "true";
  return config;
});

export default axiosInstance;
