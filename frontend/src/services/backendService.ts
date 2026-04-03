import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 60000,
});

// Upload file
export async function uploadMedia(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post("/analyze", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data; // { job_id, status }
}

// Poll job status
export async function getJobStatus(jobId: string) {
  const res = await api.get(`/status/${jobId}`);
  return res.data;
}