import axios from 'axios';

// Base URL of the FastAPI backend. Override it with VITE_API_URL when the API
// does not run on the default host/port (see .env.example).
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Only needed when the backend runs with API_AUTH_ENABLED=true.
const apiToken = import.meta.env.VITE_API_TOKEN;
if (apiToken) {
    apiClient.defaults.headers.common['X-API-Token'] = apiToken;
}

export default apiClient;
