const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface SendAlertEmailParams {
  to: string;
  alertName: string;
  alertType: string;
  currentValue: string;
  threshold: string;
  projectName?: string;
  dashboardUrl?: string;
}

export async function sendAlertEmail(params: SendAlertEmailParams): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set, skipping email');
    return false;
  }

  const subject = `[AgentBeam] Alert: ${params.alertName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #0a0a0b; border-radius: 12px; padding: 24px; color: #fafafa;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
          <span style="font-size: 24px;">&#9889;</span>
          <span style="font-size: 18px; font-weight: 600;">AgentBeam Alert</span>
        </div>

        <div style="background: #1c1c1f; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h2 style="margin: 0 0 8px; font-size: 16px; color: #fafafa;">${params.alertName}</h2>
          <p style="margin: 0; color: #71717a; font-size: 14px;">Type: ${params.alertType}</p>
        </div>

        <div style="background: #1c1c1f; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <p style="margin: 0 0 4px; color: #71717a; font-size: 13px;">Current Value</p>
          <p style="margin: 0; font-size: 20px; font-weight: 600; color: #ef4444;">${params.currentValue}</p>
          <p style="margin: 8px 0 0; color: #71717a; font-size: 13px;">Threshold: ${params.threshold}</p>
        </div>

        ${params.dashboardUrl ? `
        <a href="${params.dashboardUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">
          View Dashboard
        </a>
        ` : ''}
      </div>

      <p style="text-align: center; color: #71717a; font-size: 12px; margin-top: 16px;">
        Sent by AgentBeam · <a href="${params.dashboardUrl || '#'}" style="color: #3b82f6;">Manage alerts</a>
      </p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'AgentBeam <alerts@agentbeam.dev>',
        to: params.to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('[email] Resend error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[email] Send failed:', err);
    return false;
  }
}
