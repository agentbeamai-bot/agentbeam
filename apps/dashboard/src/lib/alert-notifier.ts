import { sendAlertEmail } from './email';

interface TriggeredAlert {
  alert_id: string;
  name: string;
  type: string;
  channels: { email?: string };
  currentValue: number;
  threshold: number;
}

export async function notifyTriggeredAlerts(
  alerts: TriggeredAlert[],
  dashboardUrl: string
): Promise<void> {
  for (const alert of alerts) {
    if (alert.channels.email) {
      const typeLabels: Record<string, string> = {
        cost_threshold: 'Cost Threshold',
        error_rate: 'Error Rate',
        latency: 'Latency',
      };

      const formatValue = (type: string, value: number): string => {
        switch (type) {
          case 'cost_threshold': return `$${value.toFixed(2)}`;
          case 'error_rate': return `${value.toFixed(1)}%`;
          case 'latency': return `${value.toFixed(0)}ms`;
          default: return String(value);
        }
      };

      const formatThreshold = (type: string, threshold: number): string => {
        switch (type) {
          case 'cost_threshold': return `$${threshold.toFixed(2)}`;
          case 'error_rate': return `${threshold.toFixed(1)}%`;
          case 'latency': return `${threshold.toFixed(0)}ms`;
          default: return String(threshold);
        }
      };

      await sendAlertEmail({
        to: alert.channels.email,
        alertName: alert.name,
        alertType: typeLabels[alert.type] || alert.type,
        currentValue: formatValue(alert.type, alert.currentValue),
        threshold: formatThreshold(alert.type, alert.threshold),
        dashboardUrl: `${dashboardUrl}/alerts`,
      });
    }
  }
}
