// Centralized API Configuration
// Change this single value to deploy to any environment

// Detect if we're accessing via IP address and use that for API calls
function getApiBaseUrl(): string {
  // If VITE_API_URL is explicitly set, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Check if we're accessing via IP address (not localhost)
  const currentHost = window.location.hostname;
  const currentProtocol = window.location.protocol;

  // If accessing via IP address (not localhost), use the same IP for API
  if (currentHost !== "localhost" && currentHost !== "127.0.0.1") {
    return `${currentProtocol}//${currentHost}:3000/api/v1`;
  }

  // Default to localhost
  return "http://localhost:3000/api/v1";
}

export const API_BASE_URL = getApiBaseUrl();

// Export as default for convenience
export default {
  baseURL: API_BASE_URL,
};
