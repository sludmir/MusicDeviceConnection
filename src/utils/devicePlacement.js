/**
 * Smart Device Placement System
 * 
 * This service intelligently places devices in the correct spots based on:
 * - Device type and role (brain, input, output, effects, etc.)
 * - Setup type (DJ, Producer, Musician)
 * - Available spots
 * - Device hierarchy and connections
 */

// Device roles define the function of each device in a setup
export const DEVICE_ROLES = {
  BRAIN: 'brain',           // Central hub (mixer for DJ, laptop/interface for Producer)
  INPUT: 'input',           // Source devices (players, instruments)
  OUTPUT: 'output',         // Output devices (speakers, monitors)
  EFFECTS: 'effects',       // Effects processors
  ACCESSORY: 'accessory'    // Accessories (headphones, stands, etc.)
};

// Device type to role mapping
export const DEVICE_TYPE_ROLES = {
  // DJ Setup
  mixer: DEVICE_ROLES.BRAIN,
  djm: DEVICE_ROLES.BRAIN,
  player: DEVICE_ROLES.INPUT,
  cdj: DEVICE_ROLES.INPUT,
  turntable: DEVICE_ROLES.INPUT,
  controller: DEVICE_ROLES.INPUT,
  fx_unit: DEVICE_ROLES.EFFECTS,
  fx: DEVICE_ROLES.EFFECTS,
  effects_processor: DEVICE_ROLES.EFFECTS,
  monitor: DEVICE_ROLES.OUTPUT,
  speaker: DEVICE_ROLES.OUTPUT,
  pa_speaker: DEVICE_ROLES.OUTPUT,
  subwoofer: DEVICE_ROLES.OUTPUT,
  
  // Producer Setup
  computer: DEVICE_ROLES.BRAIN,
  laptop: DEVICE_ROLES.BRAIN,
  audio_interface: DEVICE_ROLES.BRAIN,
  synthesizer: DEVICE_ROLES.INPUT,
  midi_controller: DEVICE_ROLES.INPUT,
  studio_monitor: DEVICE_ROLES.OUTPUT,
  microphone: DEVICE_ROLES.INPUT,
  
  // Musician Setup
  instrument: DEVICE_ROLES.INPUT,
  guitar: DEVICE_ROLES.INPUT,
  bass: DEVICE_ROLES.INPUT,
  keyboard: DEVICE_ROLES.INPUT,
  amplifier: DEVICE_ROLES.OUTPUT,
  guitar_amp: DEVICE_ROLES.OUTPUT,
  bass_amp: DEVICE_ROLES.OUTPUT,
  pedal: DEVICE_ROLES.EFFECTS,
  
  // Common
  cable: DEVICE_ROLES.ACCESSORY,
  headphones: DEVICE_ROLES.ACCESSORY,
  stand: DEVICE_ROLES.ACCESSORY,
  case: DEVICE_ROLES.ACCESSORY
};

// Spot priority mapping for each setup type
export const SPOT_PRIORITIES = {
  DJ: {
    [DEVICE_ROLES.BRAIN]: ['middle'],  // Mixer goes in middle
    [DEVICE_ROLES.INPUT]: ['middle_left', 'middle_right', 'far_left', 'far_right'],  // Players around mixer
    [DEVICE_ROLES.EFFECTS]: ['fx_top', 'fx_left', 'fx_right', 'fx_front'],  // FX units
    [DEVICE_ROLES.OUTPUT]: ['speaker_left', 'speaker_right', 'middle_back'],  // Speakers on floor or behind
    [DEVICE_ROLES.ACCESSORY]: ['middle_left_inner', 'middle_right_inner']  // Accessories
  },
  Producer: {
    [DEVICE_ROLES.BRAIN]: ['interface'],  // Laptop/Interface in center
    [DEVICE_ROLES.INPUT]: ['synth_left', 'synth_right'],  // Synthesizers on sides
    [DEVICE_ROLES.EFFECTS]: ['fx_left', 'fx_right'],  // Effects on sides
    [DEVICE_ROLES.OUTPUT]: ['monitor_left', 'monitor_right'],  // Monitors
    [DEVICE_ROLES.ACCESSORY]: ['accessory']
  },
  Musician: {
    [DEVICE_ROLES.BRAIN]: ['center'],  // Main instrument/amp
    [DEVICE_ROLES.INPUT]: ['left', 'right'],  // Instruments
    [DEVICE_ROLES.EFFECTS]: ['effects'],  // Pedals/effects
    [DEVICE_ROLES.OUTPUT]: ['output'],  // Amps/speakers
    [DEVICE_ROLES.ACCESSORY]: ['accessory']
  }
};

/**
 * Determine the role of a device based on its type
 */
export function getDeviceRole(device) {
  const type = (device.type || '').toLowerCase();
  const name = (device.name || '').toLowerCase();
  
  // Check type first
  if (DEVICE_TYPE_ROLES[type]) {
    return DEVICE_TYPE_ROLES[type];
  }
  
  // Fallback to name matching
  for (const [deviceType, role] of Object.entries(DEVICE_TYPE_ROLES)) {
    if (name.includes(deviceType)) {
      return role;
    }
  }
  
  // Default to input
  return DEVICE_ROLES.INPUT;
}

/**
 * Find the "brain" device in a setup (mixer for DJ, laptop/interface for Producer)
 */
export function findBrainDevice(devices, setupType) {
  if (!devices || devices.length === 0) return null;
  
  // For DJ: look for mixer
  if (setupType === 'DJ') {
    return devices.find(device => {
      const name = (device.name || '').toLowerCase();
      const type = (device.type || '').toLowerCase();
      return name.includes('mixer') || name.includes('djm') || type === 'mixer' || type === 'djm';
    });
  }
  
  // For Producer: look for laptop or audio interface
  if (setupType === 'Producer') {
    return devices.find(device => {
      const name = (device.name || '').toLowerCase();
      const type = (device.type || '').toLowerCase();
      return name.includes('laptop') || 
             name.includes('computer') || 
             name.includes('interface') || 
             type === 'laptop' || 
             type === 'computer' || 
             type === 'audio_interface';
    });
  }
  
  // For Musician: could be main amp or instrument
  return devices[0]; // Default to first device
}

/**
 * Get available spots for a device role in a setup
 */
export function getAvailableSpotsForRole(role, setupType, occupiedSpots = []) {
  const priorities = SPOT_PRIORITIES[setupType]?.[role] || [];
  return priorities.filter(spot => !occupiedSpots.includes(spot));
}

/**
 * Determine the best spot for a new device
 */
export function calculateOptimalSpot(device, setupType, existingDevices = [], availableSpots = []) {
  const role = getDeviceRole(device);
  const brainDevice = findBrainDevice(existingDevices, setupType);
  
  // Get occupied spots
  const occupiedSpots = existingDevices
    .filter(d => d.spotType)
    .map(d => d.spotType);
  
  // Get priority spots for this role
  const prioritySpots = getAvailableSpotsForRole(role, setupType, occupiedSpots);
  
  // If brain device exists and we're adding another brain, place it in a secondary position
  if (role === DEVICE_ROLES.BRAIN && brainDevice) {
    // For beginner setups, allow laptop + mixer
    if (setupType === 'DJ' && device.type?.toLowerCase().includes('laptop')) {
      return availableSpots.find(spot => spot.type === 'middle_back') || availableSpots[0];
    }
    // Otherwise, find alternative spot
    return availableSpots.find(spot => !occupiedSpots.includes(spot.type)) || availableSpots[0];
  }
  
  // For brain devices, use highest priority spot
  if (role === DEVICE_ROLES.BRAIN) {
    const brainSpot = prioritySpots[0];
    if (brainSpot) {
      return availableSpots.find(spot => spot.type === brainSpot) || availableSpots[0];
    }
  }
  
  // For input devices (players), place around the brain
  if (role === DEVICE_ROLES.INPUT && brainDevice) {
    // Find first available player spot
    for (const prioritySpot of prioritySpots) {
      const spot = availableSpots.find(s => s.type === prioritySpot && !occupiedSpots.includes(s.type));
      if (spot) return spot;
    }
  }
  
  // For effects, place in FX spots
  if (role === DEVICE_ROLES.EFFECTS) {
    for (const prioritySpot of prioritySpots) {
      const spot = availableSpots.find(s => s.type === prioritySpot && !occupiedSpots.includes(s.type));
      if (spot) return spot;
    }
  }
  
  // Default: return first available spot
  return availableSpots.find(spot => !occupiedSpots.includes(spot.type)) || availableSpots[0];
}

/**
 * Validate if a device can be placed in a specific spot
 */
export function canPlaceDeviceInSpot(device, spot, setupType, existingDevices = []) {
  const role = getDeviceRole(device);
  const priorities = SPOT_PRIORITIES[setupType]?.[role] || [];
  
  // Check if spot type is in priorities for this role
  return priorities.includes(spot.type);
}

/**
 * Get recommended position for a device based on setup type and existing devices
 */
export function getRecommendedPosition(device, setupType, existingDevices = [], spotConfig) {
  const spot = calculateOptimalSpot(device, setupType, existingDevices, spotConfig);
  
  if (!spot) {
    // Fallback position
    return { x: 0, y: 1.05, z: 0 };
  }
  
  return {
    x: spot.x,
    y: spot.y,
    z: spot.z,
    spotType: spot.type
  };
}

/**
 * Check if setup has a brain device (required for proper placement)
 */
export function hasBrainDevice(devices, setupType) {
  return findBrainDevice(devices, setupType) !== null;
}

/**
 * Get setup readiness status
 */
export function getSetupReadiness(devices, setupType) {
  const brain = findBrainDevice(devices, setupType);
  const hasInputs = devices.some(d => getDeviceRole(d) === DEVICE_ROLES.INPUT);
  const hasOutputs = devices.some(d => getDeviceRole(d) === DEVICE_ROLES.OUTPUT);
  
  return {
    hasBrain: !!brain,
    hasInputs,
    hasOutputs,
    isBasicSetup: brain && hasInputs,
    isCompleteSetup: brain && hasInputs && hasOutputs
  };
}
