const TTS_API_URL = import.meta.env.VITE_TTS_API_URL as string | undefined;

export async function speakRobotLine(text: string): Promise<{ url: string }> {
  if (!TTS_API_URL) {
    throw new Error('VITE_TTS_API_URL is not configured.');
  }

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
