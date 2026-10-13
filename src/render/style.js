// Global look: 'smooth' (default: full resolution, MSAA, soft shadows, bloom, filtered textures, PBR-ish materials)
// or 'retro' (low resolution, nearest filtering, dithering: N64 feel). Set once at boot from the settings.
export const STYLE = { smooth: true, shadows: true, bloom: true };

export function setStyle(s) {
  STYLE.smooth = s.look !== 'retro';
  STYLE.shadows = s.shadows !== false;
  STYLE.bloom = s.bloom !== false;
}
