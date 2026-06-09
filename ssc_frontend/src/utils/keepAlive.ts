const BACKEND_URL =
  import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") ??
  "https://ssc-cooperative-system.onrender.com";

export function startKeepAlive() {
  const ping = () =>
    fetch(`${BACKEND_URL}/api/v1/health/`, { method: "GET" }).catch(() => {});
  ping();
  setInterval(ping, 14 * 60 * 1000);
}
