import type { Mascot } from './types';

// Pastel palette per character. We use solid pastel circles + initial as placeholder
// art (no Disney-trademarked imagery shipped). Swap to custom illustrations later.
export const MASCOT_PALETTE: Record<Mascot, { bg: string; fg: string; accent: string }> = {
  Duffy:      { bg: '#E8C9A8', fg: '#5A3E2A', accent: '#C8E6D0' },
  ShellieMay: { bg: '#F8C8C8', fg: '#7A4040', accent: '#A8DDF0' },
  Gelatoni:   { bg: '#C8E6D0', fg: '#3F6B4F', accent: '#FFCCD5' },
  StellaLou:  { bg: '#D8C8E8', fg: '#5A3F7A', accent: '#C8E6D0' },
  CookieAnn:  { bg: '#FFE9A8', fg: '#7A5A2A', accent: '#FFCCD5' },
  OluMel:     { bg: '#9DD0AC', fg: '#3F5A3F', accent: '#FFE9A8' },
  LinaBell:   { bg: '#FFCCD5', fg: '#7A4055', accent: '#D8C8E8' },
};

export const mascotEmoji: Record<Mascot, string> = {
  Duffy:      'D',
  ShellieMay: 'S',
  Gelatoni:   'G',
  StellaLou:  'St',
  CookieAnn:  'C',
  OluMel:     'O',
  LinaBell:   'L',
};

// Per-mascot framing. translateY shifts the image vertically inside the circle
// (negative pushes up, positive pushes down). Tuned so each face sits roughly
// in the centre of the avatar regardless of pose.
export const MASCOT_IMAGE: Partial<Record<Mascot, { src: string; scale: number; translateY: string }>> = {
  Duffy:      { src: '/mascots/duffy.png',      scale: 1.45, translateY: '8%'  },
  ShellieMay: { src: '/mascots/shelliemay.png', scale: 1.45, translateY: '8%'  },
  StellaLou:  { src: '/mascots/stellalou.png',  scale: 1.55, translateY: '15%' },
  CookieAnn:  { src: '/mascots/cookieann.png',  scale: 1.4,  translateY: '8%'  },
  OluMel:     { src: '/mascots/olumel.png',     scale: 1.4,  translateY: '12%' },
  LinaBell:   { src: '/mascots/linabell.png',   scale: 1.45, translateY: '12%' },
  Gelatoni:   { src: '/mascots/gelatoni.png',   scale: 1.45, translateY: '10%' },
};
