import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Health check endpoint para monitoramento (Vercel, UptimeRobot, etc).
 */
export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "vitaliano-erp",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.1.0",
    },
    { status: 200 }
  );
}
