import { appConfig } from "@/lib/env";
import type { Athlete, Job } from "@/lib/types";

export async function sendExportReadyEmail(athlete: Athlete, job: Job): Promise<boolean> {
  const config = appConfig();
  if (!config.resendApiKey || !athlete.notifications_enabled || !athlete.notification_email) {
    return false;
  }

  const downloadUrl = `${config.siteUrl}/api/download/${job.id}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: config.notificationFrom,
      to: athlete.notification_email,
      subject: "Your Strava export is ready",
      text: [
        "Your Strava export is ready.",
        "",
        `Download it here: ${downloadUrl}`,
        "",
        "The download link expires after 24 hours.",
      ].join("\n"),
    }),
  });

  if (!response.ok) {
    throw new Error(`Notification email failed: ${response.status}`);
  }

  return true;
}
