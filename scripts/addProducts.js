/**
 * Run this script from the browser console at localhost:3000 while logged in as admin.
 *
 * Paste the entire contents into the console and press Enter.
 * It will:
 *   1. Check which products already exist in Firestore
 *   2. Skip existing products (except Laptop — updates its model)
 *   3. Add new product documents with full metadata
 */

(async function addProducts() {
  // Import Firebase modules from the app's global scope
  const { db, storage } = await import('/src/firebaseConfig.js');
  const { collection, getDocs, addDoc, updateDoc, query, where, serverTimestamp, doc } = await import('firebase/firestore');
  const { ref, getDownloadURL } = await import('firebase/storage');

  // ─── Product definitions ───────────────────────────────────────────
  // Each entry maps a Storage filename to full product metadata.
  // modelScale = manual multiplier on top of auto-scaling (1.0 = real-world size).
  const NEW_PRODUCTS = [
    {
      storageFile: 'GibsonLesPaul.glb',
      name: 'Gibson Les Paul Standard',
      brand: 'Gibson',
      type: 'guitar',
      category: 'Musician',
      subcategory: 'instruments',
      description: 'Iconic solid-body electric guitar with dual humbuckers, mahogany body with maple top, and a rich sustain-heavy tone favoured across rock, blues, and jazz.',
      price: 2499,
      locationPriority: 200,
      inputs: [],
      outputs: [{ type: '1/4"', label: 'Output Jack' }],
      connections: ['1/4"'],
      specifications: { body: 'Mahogany with Maple top', neck: 'Mahogany', pickups: '2x Humbuckers', scale_length: '24.75"', weight: '4.1 kg' },
      features: ['Dual humbucker pickups', 'Tune-O-Matic bridge', 'Rosewood fingerboard', 'Nitrocellulose lacquer finish'],
    },
    {
      storageFile: 'MiniFreak.glb',
      name: 'Arturia MiniFreak',
      brand: 'Arturia',
      type: 'synthesizer',
      category: 'Producer',
      subcategory: 'synthesizers',
      description: 'Polyphonic hybrid synthesizer with two digital oscillator engines, an analog filter, extensive modulation matrix, and a 4-octave aftertouch keyboard.',
      price: 599,
      locationPriority: 300,
      inputs: [{ type: 'MIDI', label: 'MIDI In' }],
      outputs: [{ type: '1/4"', label: 'Main L' }, { type: '1/4"', label: 'Main R' }, { type: 'USB', label: 'USB' }, { type: 'MIDI', label: 'MIDI Out' }],
      connections: ['1/4"', 'USB', 'MIDI'],
      specifications: { voices: '6', oscillators: '2 digital engines', filter: 'Analog Steiner-Parker', keys: '37 slim keys', weight: '2.6 kg' },
      features: ['2 digital oscillator engines', 'Analog filter', '4 FX slots', 'Sequencer & arpeggiator', '37-key aftertouch keyboard'],
    },
    {
      storageFile: 'MinilogueXD.glb',
      name: 'Korg Minilogue XD',
      brand: 'Korg',
      type: 'synthesizer',
      category: 'Producer',
      subcategory: 'synthesizers',
      description: '4-voice analog polyphonic synthesizer with a multi-engine digital oscillator, onboard effects, 16-step sequencer, and a micro-tuning system.',
      price: 649,
      locationPriority: 300,
      inputs: [{ type: '3.5mm', label: 'Sync In' }],
      outputs: [{ type: '1/4"', label: 'Main L' }, { type: '1/4"', label: 'Main R' }, { type: '1/4"', label: 'Headphones' }, { type: 'USB', label: 'USB' }, { type: 'MIDI', label: 'MIDI Out' }],
      connections: ['1/4"', 'USB', 'MIDI', '3.5mm'],
      specifications: { voices: '4', oscillators: '2 analog + 1 multi-engine', filter: '2-pole low-pass', keys: '37 slim keys', weight: '2.8 kg' },
      features: ['4-voice analog polyphony', 'Multi-engine digital oscillator', '16-step sequencer', 'Onboard delay/reverb/modulation FX', 'Micro-tuning'],
    },
    {
      storageFile: 'PioneerDDJ400.glb',
      name: 'Pioneer DDJ-400',
      brand: 'Pioneer DJ',
      type: 'controller',
      category: 'DJ',
      subcategory: 'players',
      description: 'Compact 2-channel DJ controller designed for rekordbox. Lightweight, portable, and packed with professional features including Beat FX, Pad Scratch, and tutorial integration.',
      price: 249,
      locationPriority: 500,
      inputs: [],
      outputs: [{ type: 'RCA', label: 'Master Out' }, { type: '1/4"', label: 'Headphones' }],
      connections: ['USB', 'RCA', '1/4"'],
      specifications: { channels: '2', jog_wheels: '128mm', width_mm: '482', depth_mm: '272', height_mm: '59', weight: '2.1 kg' },
      features: ['rekordbox DJ license included', 'Beat FX', 'Pad Scratch', 'Tutorial feature', 'Portable 2.1 kg design'],
    },
    {
      storageFile: 'Prophet6.glb',
      name: 'Sequential Prophet-6',
      brand: 'Sequential',
      type: 'synthesizer',
      category: 'Producer',
      subcategory: 'synthesizers',
      description: 'Six-voice polyphonic analog synthesizer with two discrete VCOs per voice, a true analog signal path, stereo effects, and a polyphonic step sequencer. Spiritual successor to the Prophet-5.',
      price: 3299,
      locationPriority: 300,
      inputs: [{ type: 'MIDI', label: 'MIDI In' }, { type: '1/4"', label: 'Pedal' }],
      outputs: [{ type: '1/4"', label: 'Main L' }, { type: '1/4"', label: 'Main R' }, { type: '1/4"', label: 'Headphones' }, { type: 'USB', label: 'USB' }, { type: 'MIDI', label: 'MIDI Out' }],
      connections: ['1/4"', 'USB', 'MIDI'],
      specifications: { voices: '6', oscillators: '2 VCO per voice', filter: '4-pole low-pass resonant', keys: '49 semi-weighted', weight: '12.6 kg' },
      features: ['True analog signal path', '2 discrete VCOs per voice', 'Stereo analog effects', 'Polyphonic step sequencer', '49 semi-weighted keys'],
    },
    {
      storageFile: 'Rane_MP2015.glb',
      name: 'Rane MP2015',
      brand: 'Rane',
      type: 'mixer',
      category: 'DJ',
      subcategory: 'mixers',
      description: 'Premium 4-channel rotary DJ mixer with sub-mixing, balanced outputs, high-headroom analog circuitry, and dual USB sound cards for seamless DJ changeover.',
      price: 2899,
      locationPriority: 100,
      inputs: [{ type: '1/4"', label: 'Line 1' }, { type: '1/4"', label: 'Line 2' }, { type: '1/4"', label: 'Line 3' }, { type: '1/4"', label: 'Line 4' }, { type: 'RCA', label: 'Phono 1' }, { type: 'RCA', label: 'Phono 2' }],
      outputs: [{ type: 'XLR', label: 'Master L' }, { type: 'XLR', label: 'Master R' }, { type: '1/4"', label: 'Booth L' }, { type: '1/4"', label: 'Booth R' }, { type: '1/4"', label: 'Headphones' }],
      connections: ['XLR', '1/4"', 'RCA', 'USB'],
      specifications: { channels: '4', usb: '2x USB 1.1', eq: '3-band rotary isolator', width_mm: '318', depth_mm: '413', height_mm: '99', weight: '5.4 kg' },
      features: ['4-channel rotary mixer', 'Dual USB sound cards', 'Sub-mixing per channel', 'High-headroom analog design', '3-band rotary isolator EQ'],
    },
    {
      storageFile: 'Stratocaster.glb',
      name: 'Fender Stratocaster',
      brand: 'Fender',
      type: 'guitar',
      category: 'Musician',
      subcategory: 'instruments',
      description: 'The world\'s most-played electric guitar. Three single-coil pickups, tremolo bridge, contoured alder body, and the unmistakable bright, articulate Strat tone.',
      price: 1849,
      locationPriority: 200,
      inputs: [],
      outputs: [{ type: '1/4"', label: 'Output Jack' }],
      connections: ['1/4"'],
      specifications: { body: 'Alder', neck: 'Maple', pickups: '3x Single-coil', scale_length: '25.5"', weight: '3.6 kg' },
      features: ['3 single-coil pickups', '5-way selector switch', 'Synchronized tremolo bridge', 'C-shape maple neck', 'Alder body'],
    },
    {
      storageFile: 'TB303.glb',
      name: 'Roland TB-303',
      brand: 'Roland',
      type: 'synthesizer',
      category: 'Producer',
      subcategory: 'synthesizers',
      description: 'Legendary bass synthesizer and sequencer. Originally designed as a bass accompaniment machine, its squelchy resonant filter became the defining sound of acid house.',
      price: 4500,
      locationPriority: 400,
      inputs: [],
      outputs: [{ type: '1/4"', label: 'Output' }, { type: '1/4"', label: 'Headphones' }],
      connections: ['1/4"'],
      specifications: { voices: '1 (monophonic)', oscillator: '1 VCO (saw/square)', filter: '4-pole low-pass with resonance', sequencer: '16-step', weight: '1.8 kg' },
      features: ['Monophonic bass synth', 'Built-in 16-step sequencer', 'Iconic resonant filter', 'Slide and accent per step', 'Acid house classic'],
    },
    {
      storageFile: 'Technics SL 1210 Mk7.glb',
      name: 'Technics SL-1210 MK7',
      brand: 'Technics',
      type: 'turntable',
      category: 'DJ',
      subcategory: 'players',
      description: 'Direct-drive turntable built on the legendary SL-1200 platform. Coreless direct-drive motor, reverse play, pitch lock, and robust build quality for professional DJ use.',
      price: 1199,
      locationPriority: 400,
      inputs: [],
      outputs: [{ type: 'RCA', label: 'Phono Out' }],
      connections: ['RCA', 'Power'],
      specifications: { drive: 'Direct drive (coreless)', speeds: '33⅓, 45, 78 rpm', torque: '0.35 N·m', pitch_range: '±8% / ±16%', weight: '9.6 kg' },
      features: ['Coreless direct-drive motor', 'Reverse play', 'Pitch lock', 'S-shaped tonearm', 'Die-cast aluminium platter'],
    },
  ];

  // ─── Resolve Storage download URLs ──────────────────────────────────
  async function getModelURL(filename) {
    try {
      const storageRef = ref(storage, `models/${filename}`);
      return await getDownloadURL(storageRef);
    } catch (e) {
      console.error(`  ✗ Could not get URL for models/${filename}:`, e.message);
      return null;
    }
  }

  // ─── Load existing products ─────────────────────────────────────────
  console.log('📦 Loading existing products from Firestore...');
  const snap = await getDocs(collection(db, 'products'));
  const existing = new Map();
  snap.forEach(d => {
    const data = d.data();
    existing.set((data.name || '').toLowerCase().trim(), { id: d.id, ...data });
  });
  console.log(`   Found ${existing.size} existing products.`);

  // ─── Update Laptop model ────────────────────────────────────────────
  console.log('\n💻 Updating Laptop model...');
  const laptopEntry = [...existing.entries()].find(([name]) =>
    name.includes('laptop') || name.includes('macbook')
  );
  if (laptopEntry) {
    const [, laptop] = laptopEntry;
    const laptopURL = await getModelURL('Laptop.glb');
    if (laptopURL) {
      await updateDoc(doc(db, 'products', laptop.id), {
        modelPath: laptopURL,
        updatedAt: serverTimestamp(),
      });
      console.log(`   ✓ Updated Laptop (${laptop.id}) modelPath.`);
    }
  } else {
    console.log('   ⚠ No existing Laptop product found — will add as new.');
    NEW_PRODUCTS.push({
      storageFile: 'Laptop.glb',
      name: 'Laptop (MacBook Pro 16")',
      brand: 'Apple',
      type: 'controller',
      category: 'DJ',
      subcategory: 'accessories',
      description: 'MacBook Pro 16-inch. Used as the central hub for DJ software like rekordbox, Traktor, or Serato, or as a DAW workstation for production.',
      price: 2499,
      locationPriority: 50,
      inputs: [{ type: 'USB-C', label: 'Thunderbolt 1' }, { type: 'USB-C', label: 'Thunderbolt 2' }, { type: 'USB-C', label: 'Thunderbolt 3' }],
      outputs: [{ type: '3.5mm', label: 'Headphone Jack' }, { type: 'USB-C', label: 'Thunderbolt' }],
      connections: ['USB-C', '3.5mm'],
      specifications: { display: '16.2"', chip: 'Apple Silicon', weight: '2.14 kg' },
      features: ['Thunderbolt 4 ports', 'Low-latency audio', 'Retina display'],
    });
  }

  // ─── Add new products ───────────────────────────────────────────────
  let added = 0, skipped = 0;
  for (const product of NEW_PRODUCTS) {
    const nameKey = product.name.toLowerCase().trim();
    if (existing.has(nameKey)) {
      console.log(`⏭  Skipping "${product.name}" — already exists (${existing.get(nameKey).id}).`);
      skipped++;
      continue;
    }

    console.log(`\n➕ Adding "${product.name}"...`);
    const modelURL = await getModelURL(product.storageFile);
    if (!modelURL) {
      console.log(`   ✗ Skipped — no model URL.`);
      continue;
    }

    const docData = {
      name: product.name,
      type: product.type,
      brand: product.brand,
      description: product.description,
      category: product.category,
      subcategory: product.subcategory,
      price: product.price,
      locationPriority: product.locationPriority,
      inputs: product.inputs,
      outputs: product.outputs,
      connections: product.connections,
      specifications: product.specifications,
      features: product.features,
      modelPath: modelURL,
      modelScale: 1.0,
      imageUrl: '',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      const docRef = await addDoc(collection(db, 'products'), docData);
      console.log(`   ✓ Created ${docRef.id}`);
      added++;
    } catch (e) {
      console.log(`   ✗ Failed: ${e.message}`);
    }
  }

  console.log(`\n✅ Done! Added: ${added}, Skipped: ${skipped}`);
})();
