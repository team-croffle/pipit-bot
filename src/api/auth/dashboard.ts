import type { IncomingMessage } from "node:http";

export function isDashboardAuthorized(
  req: IncomingMessage,
  token: string,
): boolean {
  const header = req.headers["x-pipit-dashboard-token"];
  if (typeof header !== "string") {
    return false;
  }

  return header === token;
}
