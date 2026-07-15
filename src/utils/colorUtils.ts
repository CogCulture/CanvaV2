/**
 * Converts a hex color string to CMYK percentages (0-100).
 */
export function hexToCmyk(hex: string): { c: number; m: number; y: number; k: number } {
  // Remove hash if present
  let cleanHex = hex.replace('#', '');
  
  // Handle 3-digit hex
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }

  // Handle invalid hex
  if (cleanHex.length !== 6) {
    return { c: 0, m: 0, y: 0, k: 0 };
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const k = 1 - Math.max(r, g, b);
  
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);

  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100)
  };
}

/**
 * Converts CMYK percentages (0-100) to a hex color string.
 */
export function cmykToHex(c: number, m: number, y: number, k: number): string {
  // Normalize values to 0-1
  const cNorm = Math.min(100, Math.max(0, c)) / 100;
  const mNorm = Math.min(100, Math.max(0, m)) / 100;
  const yNorm = Math.min(100, Math.max(0, y)) / 100;
  const kNorm = Math.min(100, Math.max(0, k)) / 100;

  let r = Math.round(255 * (1 - cNorm) * (1 - kNorm));
  let g = Math.round(255 * (1 - mNorm) * (1 - kNorm));
  let b = Math.round(255 * (1 - yNorm) * (1 - kNorm));

  // Ensure bounds
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));

  const toHex = (n: number) => {
    const hex = n.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
