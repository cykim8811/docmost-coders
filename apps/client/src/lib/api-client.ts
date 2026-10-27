import axios, { AxiosError, AxiosInstance } from "axios";
import APP_ROUTE from "@/lib/app-route.ts";
import { isCloud } from "@/lib/config.ts";
import { codersApiUrl, isCoders, originalApiPath } from "./coders";

const api: AxiosInstance = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (isCoders()) {
    const path = axios.getUri({ ...config, baseURL: config.url?.startsWith('/api/') ? '' : '/api' });
    config.url = codersApiUrl(path);
    config.baseURL = '';
    config.params = undefined;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (isCoders() && response.status === 202) {
      throw new AxiosError('Coders is preparing the app', 'CODERS_PREPARING', response.config, response.request, response);
    }
    // we need the response headers for these endpoints
    const exemptEndpoints = [
      "/api/pages/export",
      "/api/spaces/export",
      "/api/docx-export",
      "/api/bases/export-csv",
    ];
    if (response.request.responseURL) {
      const path = originalApiPath(response.request.responseURL);
      if (path && exemptEndpoints.includes(path)) {
        return response;
      }
    }

    return response.data;
  },
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401: {
          const url = originalApiPath(error.request.responseURL);
          if (url === "/api/auth/collab-token") return;
          if (window.location.pathname.startsWith("/share/")) return;
          // public docs probe authed endpoints; reject without the login redirect
          if (
            window.location.pathname === "/docs" ||
            window.location.pathname.startsWith("/docs/")
          ) {
            break;
          }

          // Handle unauthorized error
          redirectToLogin();
          break;
        }
        case 403:
          // Handle forbidden error
          break;
        case 404:
          // Handle not found error
          if (
            error.response.data.message
              .toLowerCase()
              .includes("workspace not found")
          ) {
            console.log("workspace not found");
            if (
              !isCloud() && !isCoders() &&
              window.location.pathname != APP_ROUTE.AUTH.SETUP
            ) {
              window.location.href = APP_ROUTE.AUTH.SETUP;
            }
          }
          break;
        case 500:
          // Handle internal server error
          break;
        default:
          break;
      }
    }
    return Promise.reject(error);
  },
);

function redirectToLogin() {
  if (isCoders()) return; // Core owns sign-in; a password form cannot repair a Core session.
  const exemptPaths = [
    APP_ROUTE.AUTH.LOGIN,
    APP_ROUTE.AUTH.SIGNUP,
    APP_ROUTE.AUTH.FORGOT_PASSWORD,
    APP_ROUTE.AUTH.PASSWORD_RESET,
    APP_ROUTE.AUTH.MFA_CHALLENGE,
    APP_ROUTE.AUTH.MFA_SETUP_REQUIRED,
    "/invites",
    // the oauth consent page redirects to login itself, preserving its query string
    "/oauth/consent",
  ];
  const { pathname, search, hash } = window.location;
  if (!exemptPaths.some((path) => pathname.startsWith(path))) {
    if (pathname === APP_ROUTE.HOME) {
      window.location.href = APP_ROUTE.AUTH.LOGIN;
    } else {
      const params = new URLSearchParams({ redirect: pathname + search + hash });
      window.location.href = `${APP_ROUTE.AUTH.LOGIN}?${params.toString()}`;
    }
  }
}

export default api;
