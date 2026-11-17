import { PX_PER_M, ROOM_HEIGHT_M } from "./palette.ts";

export type PropKind = "fan" | "lamp" | "books" | "mug" | "plant" | "banner" | "spot";

export interface Prop {
  id: string;
  kind: PropKind;
  /** metres from the start of the room, centre of the prop */
  x: number;
  /** metres above the floor, centre of the prop */
  y: number;
  /** collision box in metres */
  w: number;
  h: number;
  /** degrees per second, for spinning props */
  spin?: number;
}

export interface AirZone {
  id: string;
  kind: "up" | "down";
  x: number;
  width: number;
  /** how fast the air itself is moving vertically, in m/s */
  lift: number;
  /** metres above the floor where the band starts and ends */
  yMin: number;
  yMax: number;
}

export interface Pickup {
  id: string;
  kind: "clip" | "star";
  x: number;
  y: number;
}

export interface Room {
  id: string;
  name: string;
  blurb: string;
  /** how long the room is, in metres */
  lengthM: number;
  /** hand height at the throw, in metres */
  launchY: number;
  ceilingM: number;
  /** the basket the dart should land in */
  target: { x: number; width: number; topY: number };
  props: Prop[];
  air: AirZone[];
  pickups: Pickup[];
  /** fraction of the crease line where the green band sits, and its half width */
  creaseBand: { centre: number; half: number };
  /** expected score for three stars on this room */
  threeStarScore: number;
}

export const ROOMS: Room[] = [
  {
    id: "nook",
    name: "Desk Nook",
    blurb: "One sheet, one basket, one quiet afternoon.",
    lengthM: 24,
    launchY: 2.7,
    ceilingM: ROOM_HEIGHT_M,
    target: { x: 24, width: 1.8, topY: 0.62 },
    props: [{ id: "nook-plant", kind: "plant", x: 4, y: 0.55, w: 0.75, h: 1.1 }],
    air: [{ id: "nook-up", kind: "up", x: 9.5, width: 9, lift: 3.4, yMin: 0.4, yMax: 5.8 }],
    pickups: [
      { id: "n1", kind: "clip", x: 7.5, y: 2.4 },
      { id: "n2", kind: "clip", x: 13.5, y: 3.2 },
      { id: "n3", kind: "star", x: 18, y: 2.6 },
    ],
    creaseBand: { centre: 0.82, half: 0.12 },
    threeStarScore: 900,
  },
  {
    id: "study",
    name: "Study",
    blurb: "The fan is on. Mind the lamp.",
    lengthM: 30,
    launchY: 2.7,
    ceilingM: ROOM_HEIGHT_M,
    target: { x: 30, width: 1.9, topY: 0.65 },
    props: [
      { id: "study-books", kind: "books", x: 8, y: 0.45, w: 1.5, h: 0.9 },
      { id: "study-fan", kind: "fan", x: 14, y: 2.3, w: 1.5, h: 1.5, spin: 220 },
      { id: "study-lamp", kind: "lamp", x: 21, y: 1.2, w: 1.2, h: 1.6 },
      { id: "study-books2", kind: "books", x: 28, y: 0.9, w: 1.5, h: 0.9 },
    ],
    air: [
      { id: "study-up", kind: "up", x: 17, width: 9, lift: 3.4, yMin: 0.4, yMax: 5.8 },
      { id: "study-down", kind: "down", x: 25, width: 3.6, lift: -2.4, yMin: 0.4, yMax: 3.8 },
    ],
    pickups: [
      { id: "s1", kind: "clip", x: 11, y: 2.2 },
      { id: "s2", kind: "clip", x: 18.5, y: 3.6 },
      { id: "s3", kind: "star", x: 25, y: 2.8 },
      { id: "s4", kind: "clip", x: 31, y: 2.2 },
    ],
    creaseBand: { centre: 0.82, half: 0.1 },
    threeStarScore: 1400,
  },
  {
    id: "classroom",
    name: "Classroom",
    blurb: "Thirty desks, one clear line to the shelf.",
    lengthM: 42,
    launchY: 2.7,
    ceilingM: ROOM_HEIGHT_M,
    target: { x: 42, width: 2, topY: 0.68 },
    props: [
      { id: "cls-books", kind: "books", x: 12, y: 0.5, w: 1.5, h: 1.0 },
      { id: "cls-mug", kind: "mug", x: 19, y: 1.6, w: 0.8, h: 0.8 },
      { id: "cls-mobile", kind: "spot", x: 23, y: 4.8, w: 1.4, h: 1.4, spin: 90 },
      { id: "cls-books2", kind: "books", x: 31, y: 1.4, w: 1.5, h: 1.0 },
      { id: "cls-plant", kind: "plant", x: 39, y: 0.6, w: 0.8, h: 1.2 },
    ],
    air: [
      { id: "cls-up", kind: "up", x: 15, width: 9, lift: 3.4, yMin: 0.4, yMax: 5.8 },
      { id: "cls-down", kind: "down", x: 27, width: 4, lift: -2.4, yMin: 0.4, yMax: 3.8 },
      { id: "cls-up2", kind: "up", x: 36, width: 9, lift: 3.4, yMin: 0.4, yMax: 5.8 },
    ],
    pickups: [
      { id: "c1", kind: "clip", x: 9, y: 2.6 },
      { id: "c2", kind: "star", x: 14, y: 4.0 },
      { id: "c3", kind: "clip", x: 21, y: 3.0 },
      { id: "c4", kind: "clip", x: 30, y: 2.2 },
      { id: "c5", kind: "star", x: 38, y: 3.8 },
      { id: "c6", kind: "clip", x: 43, y: 2.4 },
    ],
    creaseBand: { centre: 0.82, half: 0.085 },
    threeStarScore: 1900,
  },
  {
    id: "auditorium",
    name: "Auditorium",
    blurb: "Ride the vents all the way to the stage.",
    lengthM: 48,
    launchY: 2.7,
    ceilingM: ROOM_HEIGHT_M,
    target: { x: 48, width: 2.2, topY: 0.72 },
    props: [
      { id: "aud-banner", kind: "banner", x: 11.5, y: 5.0, w: 1.0, h: 3.4 },
      { id: "aud-spot", kind: "spot", x: 21, y: 4.8, w: 1.4, h: 1.4, spin: 70 },
      { id: "aud-banner2", kind: "banner", x: 28, y: 5.0, w: 1.0, h: 3.4 },
      { id: "aud-fan", kind: "fan", x: 41, y: 2.4, w: 1.6, h: 1.6, spin: 250 },
    ],
    air: [
      { id: "aud-up", kind: "up", x: 15, width: 9, lift: 3.4, yMin: 0.4, yMax: 5.8 },
      { id: "aud-down", kind: "down", x: 25, width: 4, lift: -2.4, yMin: 0.4, yMax: 3.8 },
      { id: "aud-up2", kind: "up", x: 31, width: 9, lift: 3.4, yMin: 0.4, yMax: 5.8 },
      { id: "aud-up3", kind: "up", x: 35, width: 8, lift: 3.2, yMin: 0.4, yMax: 5.2 },
    ],
    pickups: [
      { id: "a1", kind: "clip", x: 8, y: 2.8 },
      { id: "a2", kind: "star", x: 14, y: 2.4 },
      { id: "a3", kind: "clip", x: 19.5, y: 4.2 },
      { id: "a4", kind: "clip", x: 27, y: 2.6 },
      { id: "a5", kind: "star", x: 37, y: 4.4 },
      { id: "a6", kind: "clip", x: 45, y: 2.2 },
    ],
    creaseBand: { centre: 0.82, half: 0.07 },
    threeStarScore: 2600,
  },
];

export const roomById = (id: string): Room => ROOMS.find((r) => r.id === id) ?? ROOMS[0];

/** World pixels for a room length. */
export const roomLengthPx = (room: Room): number => room.lengthM * PX_PER_M;
