export async function GET() {
  return Response.json({
    status: "ok",
    service: "claw-copilot",
    uptime: process.uptime(),
  });
}
