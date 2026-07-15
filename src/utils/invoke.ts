export async function invoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const response = await fetch(`${baseUrl}/api/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command: cmd, args }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  // Check if response is an image (for preview commands)
  const contentType = response.headers.get('content-type') || '';
  const isImageCommand = [
    'generate_preview_for_path',
    'generate_preset_preview',
    'apply_adjustments'
  ].includes(cmd);

  if (isImageCommand || contentType.startsWith('image/') || contentType === 'application/octet-stream') {
    return await response.arrayBuffer() as any;
  }

  // Tauri invoke usually returns JSON or null
  const text = await response.text();
  if (!text) {
    return null as any;
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    // Some commands might return plain text
    return text as any;
  }
}
