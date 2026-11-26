// Self-contained SVG stick-figure animations for exercises (no external resources).
// Each animation is a list of key poses. A pose is resolved with simple forward / inverse kinematics
// into joint rotations, which are emitted as CSS @keyframes on nested SVG groups.
import React from "react";
import "./exercise-animations.css";

// ---------- skeleton ---------------------------------------------------------------------------
const L = { torso: 52, neck: 4, head: 10, ua: 30, fa: 28, th: 38, sh: 38, ft: 11 };
const SHOULDER_W = 15; // front view: half shoulder width
const HIP_W = 8;       // front view: half hip width
const GROUND = 203;

// Angle convention: direction measured from "straight down", positive = toward the front (+x).
// a=0 down, a=90 forward, a=180 up, a=-90 backward. Torso angle = direction hip -> neck (upright = 180).
const rad = d => (d * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;
const dir = (a, len) => [len * Math.sin(rad(a)), len * Math.cos(rad(a))];
const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
const angleTo = (from, to) => deg(Math.atan2(to[0] - from[0], to[1] - from[1]));

/** Two-link IK. bend=+1 puts the middle joint toward +angle side, -1 toward -angle side. */
function ik(p0, p2, l1, l2, bend) {
  const dx = p2[0] - p0[0], dy = p2[1] - p0[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = angleTo(p0, p2);
  const beta = deg(Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const a1 = base + bend * beta;
  const p1 = add(p0, dir(a1, l1));
  return [a1, angleTo(p1, p2)];
}

function resolvePose(p, view) {
  const hip = p.hip || [100, 123];
  const t = p.t ?? (p.shoulder ? angleTo(hip, p.shoulder) : 180);
  const shoulder = add(hip, dir(t, L.torso));
  const arm = (ua, fa, hand, bend) => {
    if (ua != null) return [ua, fa ?? ua];
    if (hand && view === "side") return ik(shoulder, hand, L.ua, L.fa, bend ?? -1);
    return [0, 0];
  };
  const leg = (th, sh, foot, bend) => {
    if (th != null) return [th, sh ?? th];
    if (foot && view === "side") return ik(hip, foot, L.th, L.sh, bend ?? 1);
    return [0, 0];
  };
  const [ua, fa] = arm(p.ua, p.fa, p.hand, p.armBend);
  const [ua2, fa2] = (p.ua2 != null || p.hand2) ? arm(p.ua2, p.fa2, p.hand2, p.armBend2 ?? p.armBend) : [ua, fa];
  const [th, sh] = leg(p.th, p.sh, p.foot, p.legBend);
  const [th2, sh2] = (p.th2 != null || p.foot2) ? leg(p.th2, p.sh2, p.foot2, p.legBend2 ?? p.legBend) : [th, sh];
  const ft = p.ft ?? (p.footPerp ? sh + 90 : 90);
  const ft2 = p.ft2 ?? (p.footPerp ? sh2 + 90 : ft);
  return { hip, t, ua, fa, ua2, fa2, th, sh, th2, sh2, ft, ft2 };
}

const norm180 = a => { let x = ((a + 180) % 360 + 360) % 360 - 180; return x === -180 ? 180 : x; };

// SVG rotation (deg, clockwise) for every animated group, relative to its parent group.
function toTransforms(r, view) {
  const rot = v => `rotate(${v.toFixed(1)}deg)`;
  const out = { root: `translate(${r.hip[0].toFixed(1)}px, ${r.hip[1].toFixed(1)}px)` };
  if (view === "front") {
    Object.assign(out, {
      torso: norm180(-(r.t)), ua: norm180(-r.ua), fa: norm180(-(r.fa - r.ua)), ua2: norm180(-r.ua2), fa2: norm180(-(r.fa2 - r.ua2)),
      th: norm180(-r.th), sh: norm180(-(r.sh - r.th)), th2: norm180(-r.th2), sh2: norm180(-(r.sh2 - r.th2)),
      ft: norm180(-(r.ft - r.sh)), ft2: norm180(-(r.ft2 - r.sh2))
    });
  } else {
    Object.assign(out, {
      torso: norm180(-r.t), ua: norm180(-(r.ua - r.t)), fa: norm180(-(r.fa - r.ua)), ua2: norm180(-(r.ua2 - r.t)), fa2: norm180(-(r.fa2 - r.ua2)),
      th: norm180(-r.th), sh: norm180(-(r.sh - r.th)), th2: norm180(-r.th2), sh2: norm180(-(r.sh2 - r.th2)),
      ft: norm180(-(r.ft - r.sh)), ft2: norm180(-(r.ft2 - r.sh2))
    });
  }
  for (const k of Object.keys(out)) if (k !== "root") out[k] = { deg: out[k], rot };
  return out;
}

const PARTS = ["root", "torso", "ua", "fa", "ua2", "fa2", "th", "sh", "ft", "th2", "sh2", "ft2"];

// ---------- pose helpers ---------------------------------------------------------------------
const STAND = { hip: [100, 123], t: 180, foot: [102, 199] };
const SEAT = { hip: [78, 160], t: 180, foot: [114, 199] };
const pingpong = (a, b, hold = 10) => [
  { at: 0, pose: a }, { at: hold, pose: a }, { at: 50, pose: b }, { at: 50 + hold, pose: b }, { at: 100, pose: a }
];
const merge = (...ps) => Object.assign({}, ...ps);

/** Body straight from feet to shoulder, shoulder placed `armLen` from hands (above). */
function plank(feet, hands, armLen, bodyLen = L.th + L.sh + L.torso) {
  const d = Math.hypot(hands[0] - feet[0], hands[1] - feet[1]);
  const a = (bodyLen * bodyLen - armLen * armLen + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, bodyLen * bodyLen - a * a));
  const ux = (hands[0] - feet[0]) / d, uy = (hands[1] - feet[1]) / d;
  const base = [feet[0] + a * ux, feet[1] + a * uy];
  const shoulder = [base[0] + h * uy, base[1] - h * ux]; // upper solution
  const k = (L.th + L.sh) / bodyLen;
  const hip = [feet[0] + (shoulder[0] - feet[0]) * k, feet[1] + (shoulder[1] - feet[1]) * k];
  return { hip, shoulder, foot: feet, hand: hands };
}

// ---------- prop shapes (world coordinates) --------------------------------------------------
const P = {
  line: (x1, y1, x2, y2, w = 5) => ({ type: "line", x1, y1, x2, y2, w }),
  rect: (x, y, w, h, r = 3) => ({ type: "rect", x, y, w, h, r }),
  circle: (cx, cy, r) => ({ type: "circle", cx, cy, r })
};
const seatProps = (x = 78, y = 164) => [P.rect(x - 24, y, 46, 7), P.line(x, y + 7, x, GROUND, 4)];
const benchProps = (x1, x2, y) => [P.rect(x1, y, x2 - x1, 7), P.line(x1 + 10, y + 7, x1 + 10, GROUND, 4), P.line(x2 - 10, y + 7, x2 - 10, GROUND, 4)];
const backrest = (x, yTop, yBottom, lean = 0) => [P.line(x, yBottom, x - lean, yTop, 7)];
const tower = x => [P.line(x, 20, x, GROUND, 5), P.line(x - 14, 20, x + 4, 20, 5), P.rect(x - 6, 120, 12, 40, 2)];

// ---------- animation library ----------------------------------------------------------------
const seated = (extra = {}) => merge(SEAT, extra);
const standCurl = { a: merge(STAND, { hand: [106, 126], hand2: [104, 127] }), b: merge(STAND, { hand: [113, 80], hand2: [111, 82] }) };

// Two-phase gait cycle (A -> B -> A) used by running / walking.
const cycle2 = (a, b) => [{ at: 0, pose: a }, { at: 50, pose: b }, { at: 100, pose: a }];
const RUN_A = { hip: [100, 126], t: 170, foot: [128, 184], ft: 90, foot2: [72, 196], ft2: 35, ua: -35, fa: 50, ua2: 40, fa2: 125 };
const RUN_B = { hip: [100, 122], t: 170, foot: [72, 196], ft: 35, foot2: [128, 184], ft2: 90, ua: 40, fa: 125, ua2: -35, fa2: 50 };
const WALK_A = { hip: [100, 124], t: 178, foot: [118, 198], ft: 90, foot2: [84, 198], ft2: 60, ua: -20, fa: -8, ua2: 20, fa2: 35 };
const WALK_B = { hip: [100, 124], t: 178, foot: [84, 198], ft: 60, foot2: [118, 198], ft2: 90, ua: 20, fa: 35, ua2: -20, fa2: -8 };

const ANIMS = {
  "biceps-curl": { dur: 2.8, handProp: "dumbbell", frames: pingpong(standCurl.a, standCurl.b) },
  "hammer-curl": { dur: 2.8, handProp: "dumbbell-v", frames: pingpong(standCurl.a, standCurl.b) },
  "cable-curl": { dur: 2.8, handProp: "handle", props: tower(170), frames: pingpong(standCurl.a, standCurl.b) },
  "machine-curl": {
    dur: 2.8, handProp: "handle", props: [...seatProps(), P.line(96, 112, 122, 132, 7), P.line(122, 132, 122, 170, 4)],
    frames: pingpong(seated({ t: 172, ua: 58, fa: 70 }), seated({ t: 172, ua: 58, fa: 168 }))
  },
  "triceps-pushdown": {
    dur: 2.6, handProp: "handle", props: tower(150),
    frames: pingpong(merge(STAND, { t: 174, ua: -4, fa: 125 }), merge(STAND, { t: 174, ua: 2, fa: 8 }))
  },
  "triceps-machine": {
    dur: 2.6, handProp: "handle", props: [...seatProps(), ...backrest(58, 92, 164, 4)],
    frames: pingpong(seated({ ua: -42, fa: 55 }), seated({ ua: -12, fa: -6 }))
  },
  "chest-press": {
    dur: 3, handProp: "handle", props: [...seatProps(), ...backrest(64, 88, 164, 4), P.line(150, 60, 150, GROUND, 5)],
    frames: pingpong(seated({ t: 176, ua: -42, fa: 88 }), seated({ t: 176, ua: 80, fa: 86 }))
  },
  "shoulder-press": {
    dur: 3, handProp: "dumbbell", props: [...seatProps(), ...backrest(62, 84, 164, 6)],
    frames: pingpong(seated({ t: 178, ua: -18, fa: 165 }), seated({ t: 178, ua: 172, fa: 176 }))
  },
  "db-bench-press": {
    dur: 3, handProp: "dumbbell", props: benchProps(40, 130, 156),
    frames: pingpong(
      { hip: [112, 151], t: -90, hand: [64, 128], armBend: 1, foot: [150, 199] },
      { hip: [112, 151], t: -90, hand: [62, 95], armBend: 1, foot: [150, 199] })
  },
  "pec-deck": {
    view: "front", dur: 3, handProp: "handle", props: [...seatProps(100, 154)],
    lengths: { th: 14 }, frames: pingpong({ hip: [100, 150], ua: 88, fa: 170, th: 25, sh: 0 }, { hip: [100, 150], ua: 22, fa: 150, th: 25, sh: 0 })
  },
  "rear-delt": {
    view: "front", dur: 3, handProp: "handle", props: [...seatProps(100, 154)],
    lengths: { th: 14 }, frames: pingpong({ hip: [100, 150], ua: 18, fa: 14, th: 25, sh: 0 }, { hip: [100, 150], ua: 86, fa: 86, th: 25, sh: 0 })
  },
  "lateral-raise": {
    view: "front", dur: 2.8, handProp: "dumbbell-f",
    frames: pingpong({ hip: [100, 123], ua: 8, fa: 10, th: 4, sh: 4 }, { hip: [100, 123], ua: 84, fa: 88, th: 4, sh: 4 })
  },
  "face-pull": {
    dur: 2.8, handProp: "handle", props: tower(178),
    frames: pingpong(merge(STAND, { t: 176, hand: [155, 74], armBend: 1 }), merge(STAND, { t: 182, hand: [112, 62], armBend: 1 }))
  },
  "lat-pulldown": {
    dur: 3, handProp: "bar", props: [...seatProps(), P.rect(98, 140, 22, 8, 4), P.line(82, 10, 82, 40, 3)],
    frames: pingpong(seated({ t: 182, hand: [96, 50], armBend: -1 }), seated({ t: 190, hand: [92, 92], armBend: -1 }))
  },
  // Pull-up bar between two posts; hands stay on the bar, the body moves up and down.
  "pull-up": {
    dur: 3.2, props: [P.line(58, 16, 142, 16, 5), P.line(62, 16, 62, GROUND, 4), P.line(138, 16, 138, GROUND, 4)],
    frames: pingpong(
      { hip: [98, 126], t: 180, hand: [100, 18], armBend: -1, th: 12, sh: -45 },
      { hip: [97, 94], t: 186, hand: [100, 18], armBend: -1, th: 18, sh: -40 })
  },
  "dead-hang": {
    dur: 4, props: [P.line(58, 16, 142, 16, 5), P.line(62, 16, 62, GROUND, 4), P.line(138, 16, 138, GROUND, 4)],
    frames: pingpong(
      { hip: [98, 126], t: 180, hand: [100, 18], armBend: -1, th: 10, sh: -40 },
      { hip: [98, 123], t: 181, hand: [100, 18], armBend: -1, th: 14, sh: -44 }, 30)
  },
  "seated-row": {
    dur: 3, handProp: "handle", props: [P.rect(50, 170, 60, 7), P.line(80, 177, 80, GROUND, 4), P.rect(150, 160, 6, 36, 2), P.line(175, 120, 175, GROUND, 5)],
    frames: pingpong(
      { hip: [80, 166], t: 160, hand: [148, 136], foot: [150, 186] },
      { hip: [80, 166], t: 188, hand: [104, 138], foot: [150, 186] })
  },
  "australian-row": (() => {
    const bar = [78, 112];
    const down = plank([172, 199], bar, 57);
    const up = plank([172, 199], bar, 30);
    return {
      dur: 3, handProp: "bar", props: [P.line(78, 112, 78, GROUND, 4), P.circle(78, 112, 5)],
      frames: pingpong({ ...down, armBend: 1 }, { ...up, armBend: 1 })
    };
  })(),
  "leg-press": {
    dur: 3, footProp: "plate", props: [P.line(40, 196, 98, 156, 8), P.line(60, 180, 60, GROUND, 4), P.line(118, 170, 185, 110, 4)],
    frames: pingpong(
      { hip: [80, 160], t: 222, ua: 30, fa: 60, th: 150, sh: 70, footPerp: true },
      { hip: [80, 160], t: 222, ua: 30, fa: 60, th: 106, sh: 104, footPerp: true })
  },
  "seated-leg-curl": {
    dur: 2.8, footProp: "roller-back", props: [...seatProps(), ...backrest(58, 96, 164, 6), P.rect(100, 150, 30, 7, 3)],
    frames: pingpong(seated({ ua: 20, fa: 40, th: 92, sh: 92 }), seated({ ua: 20, fa: 40, th: 92, sh: -8 }))
  },
  "leg-extension": {
    dur: 2.8, footProp: "roller-front", props: [...seatProps(), ...backrest(58, 96, 164, 6)],
    frames: pingpong(seated({ ua: 15, fa: 30, th: 90, sh: 2 }), seated({ ua: 15, fa: 30, th: 90, sh: 86 }))
  },
  "lying-leg-curl": {
    dur: 2.8, footProp: "roller-back", props: benchProps(40, 160, 146),
    frames: pingpong(
      { hip: [96, 140], t: 92, ua: 2, fa: 30, th: -88, sh: -88, ft: -150 },
      { hip: [96, 140], t: 92, ua: 2, fa: 30, th: -88, sh: -172, ft: 120 })
  },
  "squats": {
    dur: 2.8,
    frames: pingpong(merge(STAND, { ua: 10, fa: 20 }), { hip: [80, 160], t: 148, foot: [102, 199], ua: 88, fa: 90 })
  },
  "chair-squat": {
    dur: 3, props: [P.rect(46, 158, 40, 7), P.line(50, 165, 50, GROUND, 4), P.line(82, 165, 82, GROUND, 4), P.line(48, 158, 46, 110, 5)],
    frames: pingpong(merge(STAND, { ua: 80, fa: 85 }), { hip: [78, 154], t: 150, foot: [104, 199], ua: 88, fa: 88 })
  },
  "smith-squat": {
    dur: 3, torsoProp: "bar-back", props: [P.line(108, 12, 108, GROUND, 4), P.line(92, 12, 92, GROUND, 2)],
    frames: pingpong(merge(STAND, { ua: -40, fa: 150 }), { hip: [82, 158], t: 160, foot: [106, 199], ua: -30, fa: 155 })
  },
  "hack-squat": {
    dur: 3, props: [P.line(60, 190, 120, 40, 6), P.rect(96, 196, 50, 6, 2)],
    frames: pingpong(
      { hip: [96, 124], t: 186, foot: [118, 197], ua: 20, fa: 120 },
      { hip: [78, 160], t: 176, foot: [118, 197], ua: 20, fa: 120 })
  },
  "jump-squats": {
    dur: 2.4,
    frames: [
      { at: 0, pose: { hip: [82, 158], t: 150, foot: [102, 199], ua: -30, fa: -20 } },
      { at: 30, pose: { hip: [82, 158], t: 150, foot: [102, 199], ua: -30, fa: -20 } },
      { at: 55, pose: { hip: [100, 104], t: 180, foot: [101, 182], ua: 165, fa: 170, ft: 50 } },
      { at: 75, pose: merge(STAND, { ua: 60, fa: 70 }) },
      { at: 100, pose: { hip: [82, 158], t: 150, foot: [102, 199], ua: -30, fa: -20 } }
    ]
  },
  "lunges": {
    dur: 3,
    frames: pingpong(
      { hip: [98, 124], t: 180, foot: [126, 199], foot2: [72, 199], ft2: 50, ua: -25, fa: 60 },
      { hip: [97, 156], t: 180, foot: [126, 199], foot2: [72, 199], ft2: 40, ua: -25, fa: 60 })
  },
  "db-lunges": {
    dur: 3, handProp: "dumbbell",
    frames: pingpong(
      { hip: [98, 124], t: 180, foot: [126, 199], foot2: [72, 199], ft2: 50, ua: 2, fa: 2 },
      { hip: [97, 156], t: 180, foot: [126, 199], foot2: [72, 199], ft2: 40, ua: 2, fa: 2 })
  },
  "rdl": {
    dur: 3.2, handProp: "bar",
    frames: pingpong(merge(STAND, { hand: [106, 128] }), { hip: [80, 128], t: 100, foot: [104, 199], hand: [131, 172] })
  },
  "glute-bridge": {
    dur: 2.8,
    frames: pingpong(
      { hip: [100, 192], t: -90, ua: 90, fa: 90, foot: [146, 198] },
      { hip: [95, 172], shoulder: [48, 192], ua: 70, fa: 70, foot: [146, 198] })
  },
  "hip-thrust": {
    dur: 3, hipProp: "bar", props: benchProps(18, 62, 160),
    frames: pingpong(
      { hip: [92, 190], shoulder: [52, 160], ua: -120, fa: -90, foot: [140, 199] },
      { hip: [100, 158], shoulder: [50, 156], ua: -120, fa: -90, foot: [140, 199] })
  },
  "abductor": {
    view: "front", dur: 3, props: [...seatProps(100, 153)],
    lengths: { th: 14 },
    frames: pingpong({ hip: [100, 149], ua: 25, fa: 10, th: 14, sh: 2 }, { hip: [100, 149], ua: 25, fa: 10, th: 60, sh: 14 })
  },
  "adductor": {
    view: "front", dur: 3, props: [...seatProps(100, 153)],
    lengths: { th: 14 },
    frames: pingpong({ hip: [100, 149], ua: 25, fa: 10, th: 60, sh: 14 }, { hip: [100, 149], ua: 25, fa: 10, th: 14, sh: 2 })
  },
  "calf-raise": {
    dur: 2.4, props: [P.rect(80, 199, 46, 5, 1)],
    frames: pingpong(merge(STAND, { hip: [100, 118], foot: [102, 194], ua: 4, fa: 4 }), { hip: [100, 110], t: 180, th: 0, sh: 0, ft: 50, ua: 4, fa: 4 })
  },
  "calf-machine": {
    dur: 2.4, handProp: "pad", props: [P.rect(80, 199, 46, 5, 1), P.line(140, 20, 140, GROUND, 5)],
    frames: pingpong(merge(STAND, { hip: [100, 118], foot: [102, 194], ua: -10, fa: 170 }), { hip: [100, 110], t: 180, th: 0, sh: 0, ft: 50, ua: -10, fa: 170 })
  },
  "push-ups": (() => {
    const up = plank([32, 199], [160, 199], 57), down = plank([32, 199], [160, 199], 32);
    return { dur: 2.6, frames: pingpong({ ...up, armBend: -1, ft: 30 }, { ...down, armBend: -1, ft: 30 }) };
  })(),
  "wall-pushup": (() => {
    const up = plank([96, 199], [150, 96], 56, 124), down = plank([96, 199], [150, 96], 30, 124);
    return { dur: 2.8, props: [P.line(156, 10, 156, GROUND, 6)], frames: pingpong({ ...up, armBend: -1, ft: 60 }, { ...down, armBend: -1, ft: 60 }) };
  })(),
  "chair-pushups": (() => {
    const up = plank([40, 199], [150, 152], 57), down = plank([40, 199], [150, 152], 31);
    return { dur: 2.8, props: [P.rect(140, 152, 44, 7), P.line(145, 159, 145, GROUND, 4), P.line(180, 159, 180, GROUND, 4), P.line(182, 152, 184, 100, 5)], frames: pingpong({ ...up, armBend: -1, ft: 40 }, { ...down, armBend: -1, ft: 40 }) };
  })(),
  "chair-dips": {
    dur: 2.8, props: [P.rect(36, 150, 40, 7), P.line(40, 157, 40, GROUND, 4), P.line(72, 157, 72, GROUND, 4), P.line(38, 150, 36, 100, 5)],
    frames: pingpong(
      { hip: [84, 146], shoulder: [78, 94], hand: [72, 150], armBend: 1, foot: [140, 199] },
      { hip: [86, 172], shoulder: [80, 121], hand: [72, 150], armBend: 1, foot: [140, 199] })
  },
  "plank": (() => {
    const base = { hip: [92, 172], shoulder: [146, 170], ua: 0, fa: 90, foot: [18, 197], ft: 20 };
    return { dur: 3.2, frames: pingpong(base, { ...base, hip: [92, 168] }) };
  })(),
  "knee-plank": (() => {
    const base = { hip: [112, 168], shoulder: [148, 170], ua: 0, fa: 90, th: -46, sh: -92, ft: -170 };
    return { dur: 3.2, frames: pingpong(base, { ...base, hip: [112, 165] }) };
  })(),
  "side-plank": (() => {
    const base = { hip: [96, 178], shoulder: [146, 168], ua: 0, fa: 40, ua2: -70, fa2: -95, foot: [22, 198], ft: 20 };
    return { dur: 3.2, frames: pingpong(base, { ...base, hip: [96, 186] }) };
  })(),
  "bird-dog": (() => {
    const n = { hip: [82, 160], shoulder: [132, 145], hand: [134, 199], th: 0, sh: -90, ft: -160 };
    const a = { ...n, hand: null, ua: 100, fa: 100, hand2: [134, 199], th2: -95, sh2: -95, ft2: -110 };
    const b = { ...n, ua2: 100, fa2: 100, th: -95, sh: -95, ft: -110, th2: 0, sh2: -90, ft2: -160 };
    return {
      dur: 4.4,
      frames: [
        { at: 0, pose: n }, { at: 20, pose: a }, { at: 32, pose: a }, { at: 50, pose: n },
        { at: 70, pose: b }, { at: 82, pose: b }, { at: 100, pose: n }
      ]
    };
  })(),
  "mountain-climbers": (() => {
    const b = plank([34, 199], [158, 199], 57);
    const p1 = { ...b, foot: [34, 199], ft: 30, foot2: [112, 186], ft2: 60 };
    const p2 = { ...b, foot: [112, 186], ft: 60, foot2: [34, 199], ft2: 30 };
    return { dur: 1.6, frames: [{ at: 0, pose: p1 }, { at: 50, pose: p2 }, { at: 100, pose: p1 }] };
  })(),
  "burpees": (() => {
    const stand = merge(STAND, { ua: 8, fa: 12 });
    const squat = { hip: [92, 170], t: 120, foot: [102, 199], hand: [132, 199], armBend: -1 };
    const pl = { ...plank([30, 199], [132, 199], 57), ft: 30 };
    const jump = { hip: [100, 104], t: 180, foot: [101, 182], ua: 170, fa: 175, ft: 50 };
    return { dur: 4, frames: [
      { at: 0, pose: stand }, { at: 18, pose: squat }, { at: 36, pose: pl }, { at: 50, pose: pl },
      { at: 66, pose: squat }, { at: 82, pose: jump }, { at: 100, pose: stand }] };
  })(),
  "jump-rope": {
    dur: 1.2, handProp: "handle",
    extras: [{ d: "M 110 126 C 150 140, 150 214, 100 212 C 52 212, 56 140, 94 126", kfs: [{ at: 0, transform: "scaleY(1)" }, { at: 50, transform: "scaleY(-0.9)" }, { at: 100, transform: "scaleY(1)" }], origin: "100px 128px" }],
    frames: [
      { at: 0, pose: merge(STAND, { ua: -8, fa: 50, hand: null }) },
      { at: 50, pose: { hip: [100, 113], t: 180, th: 0, sh: 0, ft: 60, ua: -8, fa: 60 } },
      { at: 100, pose: merge(STAND, { ua: -8, fa: 50, hand: null }) }
    ]
  },
  // ---------- cardio ----------
  "running": { dur: 1.0, frames: cycle2(RUN_A, RUN_B) },
  "treadmill-run": {
    dur: 1.0, frames: cycle2(RUN_A, RUN_B),
    props: [P.rect(46, 201, 120, 6, 3), P.line(160, 201, 170, 118, 5), P.line(170, 118, 150, 114, 5)]
  },
  "walking": { dur: 2.0, frames: cycle2(WALK_A, WALK_B) },
  "cycling": (() => {
    const crank = [112, 180], r = 15;
    const at = a => [crank[0] + r * Math.sin(rad(a)), crank[1] + r * Math.cos(rad(a))];
    const base = { hip: [86, 138], t: 140, hand: [146, 110], ft: 90, ft2: 90 };
    const pose = a => ({ ...base, foot: at(a), foot2: at(a + 180) });
    return {
      dur: 1.4,
      props: [P.rect(68, 141, 32, 6, 3), P.line(86, 147, 104, 178, 5), P.line(112, 180, 112, GROUND, 5),
        P.line(84, GROUND, 150, GROUND, 5), P.line(112, 180, 142, 112, 5), P.line(138, 110, 154, 110, 5), P.circle(112, 180, 5)],
      frames: [0, 90, 180, 270, 360].map((a, i) => ({ at: i * 25, pose: pose(90 + a) }))
    };
  })(),
  "stepping": (() => {
    const up = [126, 177], down = [102, 199];
    const base = { hip: [100, 123], t: 176, hand: [132, 118], ft: 90, ft2: 90 };
    const a = { ...base, foot: down, foot2: up };
    const b = { ...base, hip: [100, 121], foot: up, foot2: down };
    return {
      dur: 1.6, frames: pingpong(a, b, 8),
      props: [P.rect(118, 186, 52, 17, 2), P.line(126, 118, 172, 118, 5), P.line(168, 118, 168, 186, 5)]
    };
  })(),
  "swimming-crawl": (() => {
    const base = { hip: [84, 152], t: 90, th: -94, sh: -94, th2: -88, sh2: -88, ft: -60, ft2: -60 };
    const arms = [[90, -90], [0, 180], [-90, 90], [180, 0], [90, -90]];
    const kick = i => (i % 2 ? { th: -86, sh: -86, th2: -96, sh2: -96 } : {});
    return {
      dur: 2.0,
      props: [P.line(4, 140, 196, 140, 2)],
      frames: arms.map(([u1, u2], i) => ({ at: i * 25, pose: { ...base, ...kick(i), ua: u1, fa: u1, ua2: u2, fa2: u2 } }))
    };
  })(),
  "elliptical-motion": (() => {
    const base = { hip: [100, 120], t: 178, ft: 90, ft2: 90 };
    const feet = [[[120, 190], [82, 186]], [[100, 194], [102, 180]], [[82, 186], [120, 190]], [[102, 180], [100, 194]]];
    const hands = [[[112, 106], [134, 98]], [[123, 102], [123, 102]], [[134, 98], [112, 106]], [[123, 102], [123, 102]]];
    const pose = i => ({ ...base, foot: feet[i % 4][0], foot2: feet[i % 4][1], hand: hands[i % 4][0], hand2: hands[i % 4][1] });
    return {
      dur: 1.8, handProp: "handle",
      props: [P.line(66, GROUND, 162, GROUND, 5), P.line(70, 198, 150, 192, 4), P.line(150, 192, 158, 84, 5), P.line(158, 84, 144, 80, 5)],
      frames: [0, 1, 2, 3, 4].map(i => ({ at: i * 25, pose: pose(i) }))
    };
  })()
};

export const ANIMATION_IDS = Object.keys(ANIMS);

// ---------- CSS generation -------------------------------------------------------------------
const compiled = new Map();
function compile(id) {
  if (compiled.has(id)) return compiled.get(id);
  const def = ANIMS[id];
  const view = def.view || "side";
  const frames = def.frames.map(f => ({ at: f.at, tr: toTransforms(resolvePose(f.pose, view), view) }));
  // unwrap rotations so interpolation always takes the short way
  for (const part of PARTS) {
    if (part === "root") continue;
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1].tr[part].deg;
      let cur = frames[i].tr[part].deg;
      while (cur - prev > 180) cur -= 360;
      while (cur - prev < -180) cur += 360;
      frames[i].tr[part] = { ...frames[i].tr[part], deg: cur };
    }
  }
  const value = (tr, part) => part === "root" ? tr.root : `rotate(${tr[part].deg.toFixed(1)}deg)`;
  const name = `skrx-${id}`;
  const styles = {};
  let css = "";
  for (const part of PARTS) {
    const values = frames.map(f => value(f.tr, part));
    if (values.every(v => v === values[0])) { styles[part] = { transform: values[0] }; continue; }
    const kf = frames.map((f, i) => `${f.at}%{transform:${values[i]}}`).join("");
    css += `@keyframes ${name}-${part}{${kf}}`;
    styles[part] = { transform: values[0], animationName: `${name}-${part}` };
  }
  (def.extras || []).forEach((ex, i) => {
    css += `@keyframes ${name}-x${i}{${ex.kfs.map(k => `${k.at}%{transform:${k.transform}}`).join("")}}`;
  });
  const result = { css, styles, view, def, name };
  compiled.set(id, result);
  return result;
}

const injected = new Set();
function ensureCss(id, css) {
  if (typeof document === "undefined" || injected.has(id) || !css) return;
  const el = document.createElement("style");
  el.dataset.anim = id;
  el.textContent = css;
  document.head.appendChild(el);
  injected.add(id);
}

// ---------- rendering ------------------------------------------------------------------------
function HandProp({ type, len }) {
  switch (type) {
    case "dumbbell": return <g className="fig-prop"><circle cx="0" cy={len + 2} r="6.5" /><circle cx="0" cy={len + 2} r="2.5" className="fig-prop-hole" /></g>;
    case "dumbbell-v": return <rect className="fig-prop" x="-4" y={len - 8} width="8" height="20" rx="3" />;
    case "dumbbell-f": return <g className="fig-prop"><line x1="-8" y1={len + 2} x2="8" y2={len + 2} strokeWidth="3" /><rect x="-12" y={len - 4} width="5" height="12" rx="1.5" /><rect x="7" y={len - 4} width="5" height="12" rx="1.5" /></g>;
    case "bar": return <g className="fig-prop"><circle cx="0" cy={len + 1} r="8" /><circle cx="0" cy={len + 1} r="3" className="fig-prop-hole" /></g>;
    case "handle": return <line className="fig-prop-line" x1="-6" y1={len + 2} x2="6" y2={len + 2} />;
    case "pad": return <rect className="fig-prop" x="-9" y={len - 2} width="18" height="9" rx="4" />;
    default: return null;
  }
}

function Limb({ style1, style2, len1, len2, foot, footStyle, footProp, handProp, dim }) {
  return (
    <g style={style1} className="fig-joint">
      <line x1="0" y1="0" x2="0" y2={len1} className={dim ? "fig-limb fig-far" : "fig-limb"} />
      <g transform={`translate(0 ${len1})`}>
        <g style={style2} className="fig-joint">
          <line x1="0" y1="0" x2="0" y2={len2} className={dim ? "fig-limb fig-far" : "fig-limb"} />
          {handProp && !dim && <HandProp type={handProp} len={len2} />}
          {handProp && dim && <g opacity=".55"><HandProp type={handProp} len={len2} /></g>}
          {footProp === "roller-front" && !dim && <circle className="fig-prop" cx="8" cy={len2 - 6} r="6" />}
          {footProp === "roller-back" && !dim && <circle className="fig-prop" cx="-8" cy={len2 - 6} r="6" />}
          {foot && (
            <g transform={`translate(0 ${len2})`}>
              <g style={footStyle} className="fig-joint">
                <line x1="0" y1="0" x2="0" y2={L.ft} className={dim ? "fig-limb fig-foot fig-far" : "fig-limb fig-foot"} />
                {footProp === "plate" && !dim && <rect className="fig-prop" x="-9" y="-10" width="5" height="32" rx="2" />}
              </g>
            </g>
          )}
        </g>
      </g>
    </g>
  );
}

/**
 * Animated stick figure for an exercise.
 * @param {string} id - animation id (see ANIMATION_IDS)
 * @param {number} size - rendered height in px (default 220)
 * @param {number} [progress] - 0..1 to show a single paused frame (useful for previews/tests)
 */
export function ExerciseAnimation({ id, size = 220, progress, title, className = "" }) {
  const animId = ANIMS[id] ? id : "squats";
  const { css, styles, view, def } = compile(animId);
  ensureCss(animId, css);
  const lens = { ...L, ...(def.lengths || {}) };
  const timing = (s) => {
    if (!s?.animationName) return s;
    const extra = progress != null
      ? { animationDelay: `${-(progress * def.dur).toFixed(2)}s`, animationPlayState: "paused" }
      : {};
    return { ...s, animationDuration: `${def.dur}s`, animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", ...extra };
  };
  const st = Object.fromEntries(PARTS.map(p => [p, timing(styles[p])]));
  const headY = lens.torso + lens.neck + lens.head;

  const torsoCore = (
    <>
      <line x1="0" y1="0" x2="0" y2={lens.torso} className="fig-limb fig-torso" />
      <circle cx="0" cy={headY} r={lens.head} className="fig-head" />
      {def.torsoProp === "bar-back" && <g className="fig-prop"><circle cx="6" cy={lens.torso - 2} r="8" /><circle cx="6" cy={lens.torso - 2} r="3" className="fig-prop-hole" /></g>}
    </>
  );

  let figure;
  if (view === "front") {
    const arm = (side, uaS, faS) => (
      <g transform={`translate(${side * SHOULDER_W} ${-lens.torso})${side < 0 ? " scale(-1 1)" : ""}`}>
        <Limb style1={uaS} style2={faS} len1={lens.ua} len2={lens.fa} handProp={def.handProp} />
      </g>
    );
    const leg = (side, thS, shS, ftS) => (
      <g transform={`translate(${side * HIP_W} 0)${side < 0 ? " scale(-1 1)" : ""}`}>
        <Limb style1={thS} style2={shS} len1={lens.th} len2={lens.sh} foot footStyle={ftS} footProp={def.footProp} />
      </g>
    );
    figure = (
      <g style={st.root} className="fig-joint">
        {leg(1, st.th, st.sh, st.ft)}{leg(-1, st.th2, st.sh2, st.ft2)}
        <line x1={-HIP_W} y1="0" x2={HIP_W} y2="0" className="fig-limb fig-torso" />
        <line x1={-SHOULDER_W} y1={-lens.torso} x2={SHOULDER_W} y2={-lens.torso} className="fig-limb fig-torso" />
        <line x1="0" y1="0" x2="0" y2={-lens.torso} className="fig-limb fig-torso" />
        <circle cx="0" cy={-headY} r={lens.head} className="fig-head" />
        {arm(1, st.ua, st.fa)}{arm(-1, st.ua2, st.fa2)}
      </g>
    );
  } else {
    const farArm = (
      <g transform={`translate(0 ${lens.torso})`}>
        <Limb style1={st.ua2} style2={st.fa2} len1={lens.ua} len2={lens.fa} handProp={def.handProp} dim />
      </g>
    );
    const nearArm = (
      <g transform={`translate(0 ${lens.torso})`}>
        <Limb style1={st.ua} style2={st.fa} len1={lens.ua} len2={lens.fa} handProp={def.handProp} />
      </g>
    );
    figure = (
      <g style={st.root} className="fig-joint">
        <g style={st.torso} className="fig-joint">{farArm}</g>
        <Limb style1={st.th2} style2={st.sh2} len1={lens.th} len2={lens.sh} foot footStyle={st.ft2} footProp={def.footProp} dim />
        <g style={st.torso} className="fig-joint">{torsoCore}</g>
        {def.hipProp === "bar" && <g className="fig-prop"><circle cx="0" cy="-9" r="9" /><circle cx="0" cy="-9" r="3.5" className="fig-prop-hole" /></g>}
        <Limb style1={st.th} style2={st.sh} len1={lens.th} len2={lens.sh} foot footStyle={st.ft} footProp={def.footProp} />
        <g style={st.torso} className="fig-joint">{nearArm}</g>
      </g>
    );
  }

  return (
    <svg className={`exercise-animation ${className}`} viewBox="0 0 200 210" height={size} width={size * 200 / 210}
      role="img" aria-label={title ? `Animacja: ${title}` : "Animacja ćwiczenia"}>
      <line x1="8" y1={GROUND + 2} x2="192" y2={GROUND + 2} className="fig-ground" />
      {(def.props || []).map((p, i) => p.type === "line"
        ? <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} strokeWidth={p.w} className="fig-machine" />
        : p.type === "rect"
          ? <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r} className="fig-machine-fill" />
          : <circle key={i} cx={p.cx} cy={p.cy} r={p.r} className="fig-machine-fill" />)}
      {(def.extras || []).map((ex, i) => (
        <path key={i} d={ex.d} className="fig-rope" style={timing({ animationName: `skrx-${animId}-x${i}`, transformOrigin: ex.origin, transformBox: "view-box" })} />
      ))}
      {figure}
    </svg>
  );
}

/** Content of the "Demo" bottom sheet: animation + names + technique tips. */
export function ExerciseDemo({ exercise, generic }) {
  if (!exercise) return null;
  return (
    <div className="exercise-demo">
      <div className="exercise-demo-stage">
        <ExerciseAnimation id={exercise.anim} size={230} title={exercise.name} />
      </div>
      <h3>{exercise.name}</h3>
      {exercise.original && <p className="exercise-demo-original">{exercise.original}</p>}
      <span className="exercise-demo-muscle">{exercise.muscle}</span>
      {generic
        ? <p className="exercise-demo-tips">To Twoje własne ćwiczenie — animacja pokazuje ogólny ruch dla tej partii mięśni. Wykonuj je spokojnie, w pełnym zakresie i bez bólu.</p>
        : <p className="exercise-demo-tips">{exercise.tips}</p>}
    </div>
  );
}
