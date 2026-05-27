import { resolveApiBaseURL, sanitizeBaseURL } from "../../../config/apiUrl";

// API Configuration
export const API_BASE_URL = resolveApiBaseURL(import.meta.env.VITE_API_URL);
export { sanitizeBaseURL };
