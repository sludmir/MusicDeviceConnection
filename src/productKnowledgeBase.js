/**
 * Knowledge base of common music products.
 * Used by the ProductImporter to auto-fill specs when new models are detected.
 *
 * Keys are normalized lowercase match strings. Each entry has full product metadata.
 * Multiple keys can point to the same product for fuzzy matching.
 */

const KB = {};

function add(keys, product) {
  for (const k of keys) {
    KB[k.toLowerCase().replace(/[-\s:_.&]/g, '')] = product;
  }
}

// ─── DJ: Players / Controllers ───────────────────────────────────────

add(['CDJ-3000', 'CDJ3000', 'Pioneer CDJ-3000'], {
  name: 'Pioneer CDJ-3000', brand: 'Pioneer DJ', type: 'cdj', category: 'DJ', subcategory: 'players',
  description: 'Professional DJ multi player with 9" HD touchscreen, MPU engine, and advanced playback features.',
  price: 2349, locationPriority: 400,
  inputs: [{ type: 'Link', label: 'Pro DJ Link' }],
  outputs: [{ type: 'RCA', label: 'Audio Out' }, { type: 'XLR', label: 'Digital Out' }],
  connections: ['RCA', 'USB', 'Link', 'Ethernet', 'SD'],
  specifications: { display: '9" HD touchscreen', jog_wheel: '206mm', weight: '5.2 kg' },
  features: ['9" touchscreen', 'MPU engine', 'Key Sync', '96kHz/24-bit sound'],
  width_mm: 330, depth_mm: 411, height_mm: 116,
});

add(['CDJ-3000-W', 'CDJ3000W', 'CDJ3000white'], {
  name: 'Pioneer CDJ-3000-W', brand: 'Pioneer DJ', type: 'cdj', category: 'DJ', subcategory: 'players',
  description: 'White edition of the professional CDJ-3000 multi player.',
  price: 2349, locationPriority: 400,
  inputs: [{ type: 'Link', label: 'Pro DJ Link' }],
  outputs: [{ type: 'RCA', label: 'Audio Out' }, { type: 'XLR', label: 'Digital Out' }],
  connections: ['RCA', 'USB', 'Link', 'Ethernet', 'SD'],
  specifications: { display: '9" HD touchscreen', jog_wheel: '206mm', weight: '5.2 kg' },
  features: ['9" touchscreen', 'MPU engine', 'White finish'],
  width_mm: 330, depth_mm: 411, height_mm: 116,
});

add(['CDJ-2000NXS2', 'CDJ2000NXS2', 'CDJ2000', 'Pioneer CDJ-2000NXS2'], {
  name: 'Pioneer CDJ-2000NXS2', brand: 'Pioneer DJ', type: 'cdj', category: 'DJ', subcategory: 'players',
  description: 'Professional multi player with 7" touchscreen and Pro DJ Link networking.',
  price: 2199, locationPriority: 400,
  inputs: [{ type: 'Link', label: 'Pro DJ Link' }],
  outputs: [{ type: 'RCA', label: 'Audio Out' }],
  connections: ['RCA', 'USB', 'Link', 'Ethernet', 'SD'],
  specifications: { display: '7" touchscreen', weight: '4.8 kg' },
  features: ['7" touchscreen', 'Pro DJ Link', '96kHz/24-bit'],
  width_mm: 320, depth_mm: 406, height_mm: 106,
});

add(['DDJ-400', 'DDJ400', 'Pioneer DDJ-400'], {
  name: 'Pioneer DDJ-400', brand: 'Pioneer DJ', type: 'controller', category: 'DJ', subcategory: 'players',
  description: 'Compact 2-channel DJ controller for rekordbox with Beat FX and Pad Scratch.',
  price: 249, locationPriority: 500,
  inputs: [],
  outputs: [{ type: 'RCA', label: 'Master Out' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['USB', 'RCA', '1/4"'],
  specifications: { channels: '2', jog_wheels: '128mm', weight: '2.1 kg' },
  features: ['rekordbox license included', 'Beat FX', 'Pad Scratch', 'Tutorial feature'],
  width_mm: 482, depth_mm: 272, height_mm: 59,
});

add(['DDJ-1000', 'DDJ1000', 'Pioneer DDJ-1000'], {
  name: 'Pioneer DDJ-1000', brand: 'Pioneer DJ', type: 'controller', category: 'DJ', subcategory: 'players',
  description: '4-channel professional DJ controller for rekordbox with full-size jog wheels.',
  price: 1199, locationPriority: 500,
  inputs: [{ type: '1/4"', label: 'Mic' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: 'RCA', label: 'Master' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['USB', 'XLR', 'RCA', '1/4"'],
  specifications: { channels: '4', jog_wheels: '206mm', weight: '5.5 kg' },
  features: ['Full-size jog wheels', '4-channel', 'Beat FX', 'Sound Color FX'],
  width_mm: 722, depth_mm: 334, height_mm: 72,
});

add(['DDJ-FLX10', 'DDJFLX10', 'Pioneer DDJ-FLX10'], {
  name: 'Pioneer DDJ-FLX10', brand: 'Pioneer DJ', type: 'controller', category: 'DJ', subcategory: 'players',
  description: '4-channel DJ controller for rekordbox and Serato DJ Pro with Jog Cutter.',
  price: 1299, locationPriority: 500,
  inputs: [{ type: '1/4"', label: 'Mic 1' }, { type: '1/4"', label: 'Mic 2' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['USB', 'XLR', '1/4"'],
  specifications: { channels: '4', weight: '5.2 kg' },
  features: ['Jog Cutter', 'Smart Fader', 'rekordbox + Serato'],
  width_mm: 726, depth_mm: 332, height_mm: 72,
});

add(['XDJ-XZ', 'XDJXZ', 'Pioneer XDJ-XZ'], {
  name: 'Pioneer XDJ-XZ', brand: 'Pioneer DJ', type: 'controller', category: 'DJ', subcategory: 'players',
  description: '4-channel all-in-one DJ system for rekordbox and Serato.',
  price: 2499, locationPriority: 300,
  inputs: [{ type: '1/4"', label: 'Mic' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Booth' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['USB', 'XLR', '1/4"', 'RCA'],
  specifications: { channels: '4', weight: '12.8 kg' },
  features: ['All-in-one system', 'Dual USB', 'Touch strip', '7" jog wheels'],
  width_mm: 874, depth_mm: 336, height_mm: 101,
});

add(['SL-1210', 'SL1210', 'SL-1210MK7', 'SL1210MK7', 'Technics SL-1210', 'Technics'], {
  name: 'Technics SL-1210 MK7', brand: 'Technics', type: 'turntable', category: 'DJ', subcategory: 'players',
  description: 'Direct-drive turntable with coreless motor, reverse play, and pitch lock.',
  price: 1199, locationPriority: 400,
  inputs: [],
  outputs: [{ type: 'RCA', label: 'Phono Out' }],
  connections: ['RCA', 'Power'],
  specifications: { drive: 'Direct drive (coreless)', speeds: '33⅓, 45, 78 rpm', torque: '0.35 N·m', weight: '9.6 kg' },
  features: ['Coreless motor', 'Reverse play', 'Pitch lock', 'Die-cast platter'],
  width_mm: 453, depth_mm: 353, height_mm: 171,
});

add(['Traktor Kontrol S4', 'KontrolS4', 'TraktorS4', 'Kontrol S4 MK3'], {
  name: 'Native Instruments Traktor Kontrol S4 MK3', brand: 'Native Instruments', type: 'controller', category: 'DJ', subcategory: 'players',
  description: '4-channel DJ controller with motorized jog wheels and Stems control.',
  price: 899, locationPriority: 500,
  inputs: [{ type: '1/4"', label: 'Mic' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['USB', 'XLR', '1/4"'],
  specifications: { channels: '4', jog_wheels: 'Motorized haptic', weight: '3.9 kg' },
  features: ['Motorized jog wheels', 'Stems control', 'Traktor Pro included'],
  width_mm: 527, depth_mm: 314, height_mm: 46,
});

add(['Traktor X1', 'Traktor Kontrol X1', 'KontrolX1', 'TraktorX1'], {
  name: 'Native Instruments Traktor Kontrol X1', brand: 'Native Instruments', type: 'controller', category: 'DJ', subcategory: 'effects',
  description: 'Compact DJ controller for Traktor with touch-sensitive knobs, FX control, and transport buttons.',
  price: 199, locationPriority: 600,
  inputs: [],
  outputs: [],
  connections: ['USB'],
  specifications: { controls: '4 touch knobs, 16 buttons', weight: '0.38 kg' },
  features: ['Touch-sensitive knobs', 'FX control', 'Transport buttons', 'Ultra-portable'],
  width_mm: 287, depth_mm: 53, height_mm: 31,
});

// ─── DJ: Mixers ──────────────────────────────────────────────────────

add(['DJM-900NXS2', 'DJM900NXS2', 'DJM900', 'Pioneer DJM-900NXS2'], {
  name: 'Pioneer DJM-900NXS2', brand: 'Pioneer DJ', type: 'mixer', category: 'DJ', subcategory: 'mixers',
  description: '4-channel professional DJ mixer with 64-bit mixing, dual USB, and onboard effects.',
  price: 2199, locationPriority: 100,
  inputs: [{ type: 'RCA', label: 'Phono/Line 1' }, { type: 'RCA', label: 'Phono/Line 2' }, { type: 'RCA', label: 'Line 3' }, { type: 'RCA', label: 'Line 4' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Booth' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['XLR', 'RCA', '1/4"', 'USB', 'Link'],
  specifications: { channels: '4', weight: '8.6 kg' },
  features: ['64-bit mixing', 'Dual USB', 'Sound Color FX', 'Beat FX'],
  width_mm: 326, depth_mm: 411, height_mm: 108,
});

add(['DJM-V10', 'DJMV10', 'Pioneer DJM-V10'], {
  name: 'Pioneer DJM-V10', brand: 'Pioneer DJ', type: 'mixer', category: 'DJ', subcategory: 'mixers',
  description: '6-channel professional DJ mixer with 4-band EQ, compressor per channel, and send/return.',
  price: 3499, locationPriority: 100,
  inputs: [{ type: 'RCA', label: 'Phono 1' }, { type: 'RCA', label: 'Phono 2' }, { type: '1/4"', label: 'Line 3' }, { type: '1/4"', label: 'Line 4' }, { type: '1/4"', label: 'Line 5' }, { type: '1/4"', label: 'Line 6' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: 'XLR', label: 'Booth L' }, { type: 'XLR', label: 'Booth R' }],
  connections: ['XLR', 'RCA', '1/4"', 'USB'],
  specifications: { channels: '6', weight: '13.0 kg' },
  features: ['6-channel', '4-band EQ', 'Compressor per channel', 'Send/Return FX'],
  width_mm: 410, depth_mm: 511, height_mm: 123,
});

add(['DJM-A9', 'DJMA9', 'Pioneer DJM-A9'], {
  name: 'Pioneer DJM-A9', brand: 'Pioneer DJ', type: 'mixer', category: 'DJ', subcategory: 'mixers',
  description: '4-channel professional DJ mixer, successor to the DJM-900NXS2.',
  price: 2599, locationPriority: 100,
  inputs: [{ type: 'RCA', label: 'Phono 1' }, { type: 'RCA', label: 'Phono 2' }, { type: 'RCA', label: 'Line 3' }, { type: 'RCA', label: 'Line 4' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Booth' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['XLR', 'RCA', '1/4"', 'USB'],
  specifications: { channels: '4', weight: '8.6 kg' },
  features: ['Smooth Echo', 'Beat FX', 'Touch MIDI', 'Dual USB-C'],
  width_mm: 326, depth_mm: 411, height_mm: 108,
});

add(['Xone:96', 'Xone96', 'A&H Xone:96', 'Allen Heath Xone 96', 'AHXone96', 'A&HXone96'], {
  name: 'Allen & Heath Xone:96', brand: 'Allen & Heath', type: 'mixer', category: 'DJ', subcategory: 'mixers',
  description: '6-channel analogue DJ mixer with dual 32-bit USB soundcards, dual filters, and Crunch distortion.',
  price: 2199, locationPriority: 100,
  inputs: [{ type: 'RCA', label: 'Phono 1' }, { type: 'RCA', label: 'Phono 2' }, { type: '1/4"', label: 'Line 3' }, { type: '1/4"', label: 'Line 4' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Booth' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['XLR', 'RCA', '1/4"', 'USB'],
  specifications: { channels: '6', weight: '10.5 kg' },
  features: ['Dual filters', 'Crunch distortion', 'Dual USB', 'Analogue warmth'],
  width_mm: 320, depth_mm: 412, height_mm: 108,
});

add(['Xone:92', 'Xone92', 'A&H Xone:92', 'AHXone92'], {
  name: 'Allen & Heath Xone:92', brand: 'Allen & Heath', type: 'mixer', category: 'DJ', subcategory: 'mixers',
  description: '6-channel analogue DJ mixer with VCF filters and 4-bus architecture.',
  price: 1799, locationPriority: 100,
  inputs: [{ type: 'RCA', label: 'Phono 1' }, { type: 'RCA', label: 'Phono 2' }, { type: '1/4"', label: 'Line 3' }, { type: '1/4"', label: 'Line 4' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Booth' }],
  connections: ['XLR', 'RCA', '1/4"'],
  specifications: { channels: '6', weight: '10.2 kg' },
  features: ['VCF filters', '4-bus architecture', 'Analogue'],
  width_mm: 320, depth_mm: 358, height_mm: 99,
});

add(['MP2015', 'RaneMP2015', 'Rane MP2015'], {
  name: 'Rane MP2015', brand: 'Rane', type: 'mixer', category: 'DJ', subcategory: 'mixers',
  description: 'Premium 4-channel rotary DJ mixer with dual USB and high-headroom analog circuitry.',
  price: 2899, locationPriority: 100,
  inputs: [{ type: '1/4"', label: 'Line 1' }, { type: '1/4"', label: 'Line 2' }, { type: 'RCA', label: 'Phono 1' }, { type: 'RCA', label: 'Phono 2' }],
  outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Booth' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['XLR', '1/4"', 'RCA', 'USB'],
  specifications: { channels: '4', weight: '5.4 kg' },
  features: ['4-channel rotary', 'Dual USB', 'Sub-mixing', 'Isolator EQ'],
  width_mm: 318, depth_mm: 413, height_mm: 99,
});

// ─── DJ: Effects ─────────────────────────────────────────────────────

add(['RMX-1000', 'RMX1000', 'Pioneer RMX-1000'], {
  name: 'Pioneer RMX-1000', brand: 'Pioneer DJ', type: 'fx_unit', category: 'DJ', subcategory: 'effects',
  description: 'Performance effects unit with Scene FX, Isolate FX, X-Pad, and Release FX.',
  price: 699, locationPriority: 700,
  inputs: [{ type: 'RCA', label: 'Input L/R' }],
  outputs: [{ type: 'RCA', label: 'Output L/R' }],
  connections: ['RCA', 'USB', 'MIDI'],
  specifications: { weight: '2.0 kg' },
  features: ['Scene FX', 'Isolate FX', 'X-Pad', 'Release FX'],
  width_mm: 306, depth_mm: 338, height_mm: 82,
});

add(['DJS-1000', 'DJS1000', 'Pioneer DJS-1000'], {
  name: 'Pioneer DJS-1000', brand: 'Pioneer DJ', type: 'fx_unit', category: 'DJ', subcategory: 'effects',
  description: 'Standalone DJ sampler with 16 performance pads, step sequencer, and touchscreen.',
  price: 1499, locationPriority: 700,
  inputs: [{ type: 'Link', label: 'Pro DJ Link' }],
  outputs: [{ type: 'RCA', label: 'Master Out' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['RCA', 'USB', 'Link', 'MIDI'],
  specifications: { pads: '16 velocity-sensitive', display: '7" touchscreen', weight: '3.4 kg' },
  features: ['16-step sequencer', '16 pads', 'Touchscreen', 'Pro DJ Link sync'],
  width_mm: 306, depth_mm: 338, height_mm: 73,
});

add(['SP-16', 'SP16', 'Toraiz SP-16'], {
  name: 'Pioneer SP-16', brand: 'Pioneer DJ', type: 'fx_unit', category: 'DJ', subcategory: 'effects',
  description: 'Professional sampler with Dave Smith analog filter, 16 pads, and 7" touchscreen.',
  price: 1599, locationPriority: 700,
  inputs: [{ type: '1/4"', label: 'Audio In L' }, { type: '1/4"', label: 'Audio In R' }],
  outputs: [{ type: '1/4"', label: 'Master L' }, { type: '1/4"', label: 'Master R' }],
  connections: ['1/4"', 'USB', 'MIDI'],
  specifications: { weight: '3.2 kg' },
  features: ['Dave Smith analog filter', '16 pads', 'Step sequencer'],
  width_mm: 306, depth_mm: 253, height_mm: 68,
});

// ─── DJ: Speakers ────────────────────────────────────────────────────

add(['Bose L1 Pro16', 'BoseL1', 'L1Pro16', 'L1Pro', 'L1 Pro'], {
  name: 'Bose L1 Pro16', brand: 'Bose', type: 'pa_speaker', category: 'DJ', subcategory: 'speakers',
  description: 'Portable line array speaker system with built-in mixer and Bluetooth.',
  price: 2399, locationPriority: 900,
  inputs: [{ type: 'XLR', label: 'Ch 1' }, { type: 'XLR', label: 'Ch 2' }, { type: '1/4"', label: 'Ch 3' }],
  outputs: [{ type: 'XLR', label: 'Line Out' }],
  connections: ['XLR', '1/4"', '3.5mm'],
  specifications: { max_spl: '112 dB', weight: '19.6 kg' },
  features: ['Line array', 'Built-in mixer', 'Bluetooth', '180° coverage'],
  width_mm: 330, depth_mm: 380, height_mm: 2030,
});

// ─── Producer: Synthesizers ──────────────────────────────────────────

add(['Minimoog', 'Minimoog Model D', 'Moog Minimoog', 'MoogModelD'], {
  name: 'Moog Minimoog Model D', brand: 'Moog', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: 'Legendary monophonic analog synthesizer with 3 oscillators and the iconic Moog ladder filter.',
  price: 5499, locationPriority: 300,
  inputs: [{ type: '1/4"', label: 'External Audio' }],
  outputs: [{ type: '1/4"', label: 'Main Out' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['1/4"'],
  specifications: { voices: '1 (monophonic)', oscillators: '3 VCO', filter: 'Moog Ladder 4-pole', weight: '14.5 kg' },
  features: ['3 oscillators', 'Moog ladder filter', 'Analog signal path'],
  width_mm: 603, depth_mm: 410, height_mm: 142,
});

add(['TB-303', 'TB303', 'Roland TB-303'], {
  name: 'Roland TB-303', brand: 'Roland', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: 'Legendary bass synth and sequencer — the defining sound of acid house.',
  price: 4500, locationPriority: 400,
  inputs: [],
  outputs: [{ type: '1/4"', label: 'Output' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['1/4"'],
  specifications: { voices: '1', oscillator: '1 VCO (saw/square)', filter: '4-pole LP', sequencer: '16-step', weight: '1.8 kg' },
  features: ['16-step sequencer', 'Resonant filter', 'Slide & accent'],
  width_mm: 305, depth_mm: 175, height_mm: 57,
});

add(['Minilogue XD', 'MinilogueXD', 'Korg Minilogue XD', 'Minilogue'], {
  name: 'Korg Minilogue XD', brand: 'Korg', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: '4-voice analog poly synth with multi-engine digital oscillator and onboard effects.',
  price: 649, locationPriority: 300,
  inputs: [{ type: '3.5mm', label: 'Sync In' }],
  outputs: [{ type: '1/4"', label: 'Main L' }, { type: '1/4"', label: 'Main R' }, { type: '1/4"', label: 'Headphones' }, { type: 'USB', label: 'USB' }, { type: 'MIDI', label: 'MIDI Out' }],
  connections: ['1/4"', 'USB', 'MIDI', '3.5mm'],
  specifications: { voices: '4', oscillators: '2 analog + 1 multi-engine', filter: '2-pole LP', keys: '37', weight: '2.8 kg' },
  features: ['4-voice analog', 'Multi-engine oscillator', '16-step sequencer', 'Onboard FX'],
  width_mm: 500, depth_mm: 300, height_mm: 85,
});

add(['Prophet-6', 'Prophet6', 'Sequential Prophet-6', 'Sequential Prophet'], {
  name: 'Sequential Prophet-6', brand: 'Sequential', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: '6-voice polyphonic analog synth with true analog signal path and stereo effects.',
  price: 3299, locationPriority: 300,
  inputs: [{ type: 'MIDI', label: 'MIDI In' }, { type: '1/4"', label: 'Pedal' }],
  outputs: [{ type: '1/4"', label: 'Main L' }, { type: '1/4"', label: 'Main R' }, { type: '1/4"', label: 'Headphones' }, { type: 'USB', label: 'USB' }],
  connections: ['1/4"', 'USB', 'MIDI'],
  specifications: { voices: '6', oscillators: '2 VCO per voice', filter: '4-pole LP', keys: '49', weight: '12.6 kg' },
  features: ['True analog', '2 VCO per voice', 'Stereo effects', 'Poly step sequencer'],
  width_mm: 632, depth_mm: 314, height_mm: 110,
});

add(['MiniFreak', 'Arturia MiniFreak'], {
  name: 'Arturia MiniFreak', brand: 'Arturia', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: 'Polyphonic hybrid synth with 2 digital oscillator engines and analog filter.',
  price: 599, locationPriority: 300,
  inputs: [{ type: 'MIDI', label: 'MIDI In' }],
  outputs: [{ type: '1/4"', label: 'Main L' }, { type: '1/4"', label: 'Main R' }, { type: 'USB', label: 'USB' }, { type: 'MIDI', label: 'MIDI Out' }],
  connections: ['1/4"', 'USB', 'MIDI'],
  specifications: { voices: '6', oscillators: '2 digital engines', filter: 'Steiner-Parker', keys: '37', weight: '2.6 kg' },
  features: ['2 digital engines', 'Analog filter', '4 FX slots', 'Sequencer & arp'],
  width_mm: 528, depth_mm: 278, height_mm: 60,
});

add(['Juno-106', 'Juno106', 'Roland Juno-106'], {
  name: 'Roland Juno-106', brand: 'Roland', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: '6-voice analog poly synth with chorus effect — a classic of 80s synth-pop and house.',
  price: 3500, locationPriority: 300,
  inputs: [],
  outputs: [{ type: '1/4"', label: 'Output' }],
  connections: ['1/4"'],
  specifications: { voices: '6', filter: '4-pole LP', keys: '61', weight: '6.3 kg' },
  features: ['6-voice polyphony', 'Built-in chorus', '61 keys', 'Classic analog'],
  width_mm: 970, depth_mm: 300, height_mm: 80,
});

add(['Push 3', 'Push3', 'Ableton Push 3', 'AbletonPush'], {
  name: 'Ableton Push 3', brand: 'Ableton', type: 'midi_controller', category: 'Producer', subcategory: 'controllers',
  description: 'Standalone instrument and controller for Ableton Live with MPE pads and built-in audio interface.',
  price: 1999, locationPriority: 500,
  inputs: [{ type: 'USB-C', label: 'USB-C' }, { type: '1/4"', label: 'Pedal 1' }],
  outputs: [{ type: '1/4"', label: 'Out 1' }, { type: '1/4"', label: 'Out 2' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['USB-C', '1/4"', 'MIDI'],
  specifications: { pads: '64 MPE', display: '5.25" color', weight: '3.0 kg' },
  features: ['Standalone operation', 'MPE pads', 'Built-in audio I/O', 'Color display'],
  width_mm: 375, depth_mm: 303, height_mm: 47,
});

// ─── Producer: Drum machines ─────────────────────────────────────────

add(['TR-909', 'TR909', 'Roland TR-909'], {
  name: 'Roland TR-909', brand: 'Roland', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: 'Legendary analog/digital drum machine — the backbone of house and techno.',
  price: 5000, locationPriority: 400,
  inputs: [],
  outputs: [{ type: '1/4"', label: 'Mix Out' }, { type: '1/4"', label: 'Individual Outs' }],
  connections: ['1/4"', 'MIDI'],
  specifications: { voices: '11 instruments', sequencer: '16-step', weight: '4.8 kg' },
  features: ['Analog drum sounds', 'Digital cymbals', '16-step sequencer', 'Accent & flam'],
  width_mm: 480, depth_mm: 300, height_mm: 70,
});

add(['TR-808', 'TR808', 'Roland TR-808'], {
  name: 'Roland TR-808', brand: 'Roland', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: 'The most influential drum machine ever made. Analog sounds that defined hip-hop and electronic music.',
  price: 5500, locationPriority: 400,
  inputs: [],
  outputs: [{ type: '1/4"', label: 'Mix Out' }, { type: '1/4"', label: 'Individual Outs' }],
  connections: ['1/4"'],
  specifications: { voices: '11 instruments', sequencer: '16-step', weight: '5.0 kg' },
  features: ['Analog drum synthesis', '16-step sequencer', 'Iconic kick & snare'],
  width_mm: 500, depth_mm: 300, height_mm: 90,
});

add(['Digitakt', 'Elektron Digitakt'], {
  name: 'Elektron Digitakt', brand: 'Elektron', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: '8-track digital drum machine and sampler with parameter locks and Overbridge.',
  price: 799, locationPriority: 400,
  inputs: [{ type: '1/4"', label: 'Input L' }, { type: '1/4"', label: 'Input R' }],
  outputs: [{ type: '1/4"', label: 'Main L' }, { type: '1/4"', label: 'Main R' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['1/4"', 'USB', 'MIDI'],
  specifications: { tracks: '8 audio + 8 MIDI', weight: '1.49 kg' },
  features: ['Parameter locks', 'Overbridge', '8 audio tracks', 'Sampling engine'],
  width_mm: 215, depth_mm: 176, height_mm: 63,
});

// ─── Producer: Audio interfaces ──────────────────────────────────────

add(['Apollo Twin', 'ApolloTwin', 'UA Apollo Twin', 'Universal Audio Apollo Twin'], {
  name: 'Universal Audio Apollo Twin', brand: 'Universal Audio', type: 'audio_interface', category: 'Producer', subcategory: 'audio-interface',
  description: '2x6 Thunderbolt audio interface with UAD-2 processing and Unison preamps.',
  price: 1099, locationPriority: 200,
  inputs: [{ type: 'XLR', label: 'Mic/Line 1' }, { type: 'XLR', label: 'Mic/Line 2' }, { type: '1/4"', label: 'Instrument' }],
  outputs: [{ type: '1/4"', label: 'Monitor L' }, { type: '1/4"', label: 'Monitor R' }, { type: '1/4"', label: 'Headphones' }],
  connections: ['XLR', '1/4"', 'USB-C'],
  specifications: { inputs: '2', outputs: '6', sample_rate: '24-bit/192kHz', weight: '0.79 kg' },
  features: ['UAD-2 QUAD processing', 'Unison preamps', 'Thunderbolt', 'Console software'],
  width_mm: 163, depth_mm: 163, height_mm: 47,
});

// ─── Producer: Effects pedals ────────────────────────────────────────

add(['BigSky', 'Strymon BigSky'], {
  name: 'Strymon BigSky', brand: 'Strymon', type: 'pedal', category: 'Producer', subcategory: 'synthesizers',
  description: 'Multi-dimensional reverb pedal with 12 studio-quality reverb algorithms.',
  price: 479, locationPriority: 600,
  inputs: [{ type: '1/4"', label: 'Input L' }, { type: '1/4"', label: 'Input R' }],
  outputs: [{ type: '1/4"', label: 'Output L' }, { type: '1/4"', label: 'Output R' }],
  connections: ['1/4"', 'MIDI', 'USB'],
  specifications: { algorithms: '12', presets: '300', weight: '0.48 kg' },
  features: ['12 reverb algorithms', '300 presets', 'Stereo I/O', 'MIDI control'],
  width_mm: 170, depth_mm: 140, height_mm: 50,
});

add(['H9', 'EventideH9', 'Eventide H9'], {
  name: 'Eventide H9', brand: 'Eventide', type: 'pedal', category: 'Producer', subcategory: 'synthesizers',
  description: 'Multi-effects pedal with all Eventide stompbox algorithms in one box.',
  price: 699, locationPriority: 600,
  inputs: [{ type: '1/4"', label: 'Input' }],
  outputs: [{ type: '1/4"', label: 'Output 1' }, { type: '1/4"', label: 'Output 2' }],
  connections: ['1/4"', 'MIDI', 'USB'],
  specifications: { algorithms: '50+', weight: '0.38 kg' },
  features: ['All Eventide algorithms', 'Bluetooth editing', 'Expression pedal input'],
  width_mm: 120, depth_mm: 120, height_mm: 62,
});

add(['RE-201', 'RE201', 'Boss RE-201', 'Space Echo', 'SpaceEcho'], {
  name: 'Boss RE-201 Space Echo', brand: 'Boss', type: 'pedal', category: 'Producer', subcategory: 'synthesizers',
  description: 'Recreation of the legendary Roland RE-201 tape echo with spring reverb.',
  price: 449, locationPriority: 600,
  inputs: [{ type: '1/4"', label: 'Input' }],
  outputs: [{ type: '1/4"', label: 'Output A' }, { type: '1/4"', label: 'Output B' }],
  connections: ['1/4"'],
  specifications: { modes: '12', weight: '0.45 kg' },
  features: ['Tape echo emulation', 'Spring reverb', '12 modes'],
  width_mm: 430, depth_mm: 180, height_mm: 120,
});

// ─── Producer: Other ─────────────────────────────────────────────────

add(['OP-1', 'OP1', 'OP-1 Field', 'OP1Field', 'Teenage Engineering OP-1'], {
  name: 'Teenage Engineering OP-1 Field', brand: 'Teenage Engineering', type: 'synthesizer', category: 'Producer', subcategory: 'synthesizers',
  description: 'Portable all-in-one synthesizer, sampler, sequencer, and 4-track recorder.',
  price: 2199, locationPriority: 400,
  inputs: [{ type: 'USB-C', label: 'USB-C' }],
  outputs: [{ type: '3.5mm', label: 'Headphone/Line' }],
  connections: ['USB-C', '3.5mm'],
  specifications: { keys: '24', display: 'OLED', weight: '0.47 kg' },
  features: ['All-in-one workstation', 'FM radio', '4-track recorder', 'Portable'],
  width_mm: 282, depth_mm: 102, height_mm: 14,
});

// ─── Musician: Guitars ───────────────────────────────────────────────

add(['Stratocaster', 'Strat', 'Fender Stratocaster', 'FenderStrat'], {
  name: 'Fender Stratocaster', brand: 'Fender', type: 'guitar', category: 'Musician', subcategory: 'instruments',
  description: 'The world\'s most-played electric guitar. 3 single-coil pickups and tremolo bridge.',
  price: 1849, locationPriority: 200,
  inputs: [],
  outputs: [{ type: '1/4"', label: 'Output Jack' }],
  connections: ['1/4"'],
  specifications: { body: 'Alder', neck: 'Maple', pickups: '3x Single-coil', scale: '25.5"', weight: '3.6 kg' },
  features: ['3 single-coils', '5-way switch', 'Tremolo bridge', 'C-shape neck'],
  width_mm: 318, depth_mm: 998, height_mm: 45,
});

add(['Les Paul', 'LesPaul', 'Gibson Les Paul', 'GibsonLesPaul', 'Les Paul Standard'], {
  name: 'Gibson Les Paul Standard', brand: 'Gibson', type: 'guitar', category: 'Musician', subcategory: 'instruments',
  description: 'Iconic solid-body with dual humbuckers, mahogany body, and rich sustain.',
  price: 2499, locationPriority: 200,
  inputs: [],
  outputs: [{ type: '1/4"', label: 'Output Jack' }],
  connections: ['1/4"'],
  specifications: { body: 'Mahogany + Maple top', neck: 'Mahogany', pickups: '2x Humbuckers', scale: '24.75"', weight: '4.1 kg' },
  features: ['Dual humbuckers', 'Tune-O-Matic bridge', 'Rosewood fingerboard'],
  width_mm: 340, depth_mm: 990, height_mm: 55,
});

// ─── Musician: Microphones ───────────────────────────────────────────

add(['SM58', 'Shure SM58', 'ShureSM58'], {
  name: 'Shure SM58', brand: 'Shure', type: 'dynamic', category: 'Musician', subcategory: 'microphones',
  description: 'Industry-standard dynamic vocal microphone with cardioid pickup and built-in pop filter.',
  price: 99, locationPriority: 500,
  inputs: [],
  outputs: [{ type: 'XLR', label: 'XLR Out' }],
  connections: ['XLR'],
  specifications: { type: 'Dynamic', pattern: 'Cardioid', frequency: '50Hz–15kHz', weight: '0.33 kg' },
  features: ['Cardioid pattern', 'Built-in pop filter', 'Pneumatic shock mount'],
  width_mm: 51, depth_mm: 162, height_mm: 51,
});

// ─── Misc / Laptop ───────────────────────────────────────────────────

add(['Laptop', 'MacBook', 'MacBook Pro', 'MacBookPro'], {
  name: 'Laptop (MacBook Pro 16")', brand: 'Apple', type: 'controller', category: 'DJ', subcategory: 'accessories',
  description: 'MacBook Pro 16-inch — central hub for DJ software or DAW production.',
  price: 2499, locationPriority: 50,
  inputs: [{ type: 'USB-C', label: 'Thunderbolt 1' }, { type: 'USB-C', label: 'Thunderbolt 2' }, { type: 'USB-C', label: 'Thunderbolt 3' }],
  outputs: [{ type: '3.5mm', label: 'Headphone' }, { type: 'USB-C', label: 'Thunderbolt' }],
  connections: ['USB-C', '3.5mm'],
  specifications: { display: '16.2"', weight: '2.14 kg' },
  features: ['Thunderbolt 4', 'Low-latency audio', 'Retina display'],
  width_mm: 356, depth_mm: 248, height_mm: 17,
});

/**
 * Look up a product by a raw string (filename, product name, etc.)
 * Returns the knowledge base entry or null.
 */
export function lookupProduct(raw) {
  if (!raw) return null;
  const needle = raw.toLowerCase().replace(/[-\s:_.&]/g, '');
  // Direct match
  if (KB[needle]) return KB[needle];
  // Substring match
  for (const [key, val] of Object.entries(KB)) {
    if (needle.includes(key) || key.includes(needle)) return val;
  }
  return null;
}

/**
 * Parse a GLB filename into a likely product name.
 * "PioneerDDJ400.glb" → "Pioneer DDJ 400"
 * "A&HXone96final.glb" → "A H Xone 96 final"
 */
export function parseFilename(filename) {
  let name = filename.replace(/\.glb$/i, '');
  // Remove common suffixes like "final", "fixed", "bigger", "v2"
  name = name.replace(/[-_]?(final|fixed|bigger|smaller|v\d+|new|old|test)$/i, '');
  // Replace underscores with spaces
  name = name.replace(/_/g, ' ');
  // Insert spaces before uppercase letters in camelCase: "PioneerDDJ400" → "Pioneer DDJ400"
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  // Insert space between letters and numbers: "DDJ400" → "DDJ 400"
  name = name.replace(/([A-Za-z])(\d)/g, '$1 $2');
  name = name.replace(/(\d)([A-Za-z])/g, '$1 $2');
  return name.trim();
}

export default KB;
