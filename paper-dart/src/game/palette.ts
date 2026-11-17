/** Shared colour and scale constants. Mirrored in src/theme.css. */
export const PALETTE = {
  paper: 0xf7f2e6,
  paper2: 0xeadfc8,
  paper3: 0xdccfb6,
  paperBack: 0xe0d3b8,
  kraft: 0xc08a4e,
  kraftDark: 0x9a6b36,
  ink: 0x22303f,
  inkSoft: 0x5a6b7c,
  accent: 0xe4572e,
  accent2: 0x2a9d8f,
  gold: 0xe9b949,
  wall: 0xf1e8d6,
  floor: 0xd7c19a,
  glass: 0xbfd8e8,
} as const;

export const css = (hex: number): string => `#${hex.toString(16).padStart(6, "0")}`;

/** World scale: one metre of room in world pixels at design scale. */
export const PX_PER_M = 120;
/** Interior height used to frame the room vertically. */
export const ROOM_HEIGHT_M = 7.5;
export const DESIGN_H = ROOM_HEIGHT_M * PX_PER_M;
