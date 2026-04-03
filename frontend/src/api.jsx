// frontend/src/api.jsx
import axios from "axios";
import { auth } from "./firebase";

// -------------------------------
// Axios instance
// -------------------------------
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 30000,
});

// -------------------------------
// Attach Firebase token
// -------------------------------
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// -------------------------------
// Upload file
// -------------------------------
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/analyze", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data.job_id;
};

// -------------------------------
// Poll job status
// -------------------------------
export const checkJobStatus = async (jobId) => {
  const response = await api.get(`/status/${jobId}`);
  return response.data;
};

// -------------------------------
// Fetch analysis history
// -------------------------------
export const fetchHistory = async () => {
  const response = await api.get("/api/history");
  return response.data;
};

// -------------------------------
// Analyze audio file
// -------------------------------
export const analyzeAudio = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await api.post("/analyze-audio", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export default api;