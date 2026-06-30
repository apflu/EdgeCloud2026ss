// Defaults to a same-origin relative path, proxied to the TTS backend by
// Vite in dev (see vite.config.ts) and by nginx in production (see
// nginx.conf) — so the dashboard never needs to know the backend's host/port.
// Set VITE_TTS_API_URL only to point at a backend on a different origin.
const TTS_API_URL = (import.meta.env.VITE_TTS_API_URL as string | undefined) ?? '';

export async function speakRobotLine(text: string): Promise<{ url: string }> {
  const response = await fetch(`${TTS_API_URL}/api/tts/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `TTS request failed with status ${response.status}`);
  }

  return response.json();
}
