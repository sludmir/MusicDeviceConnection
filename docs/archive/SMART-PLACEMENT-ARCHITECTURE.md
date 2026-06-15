# Smart Device Placement System - Architecture

## Overview

This document describes the intelligent device placement system that automatically positions devices in the correct spots within a setup based on device roles, setup types, and existing devices.

## Core Concepts

### 1. Device Roles

Devices are categorized into roles that define their function in a setup:

- **BRAIN**: Central hub device
  - DJ Setup: Mixer (DJM series)
  - Producer Setup: Laptop or Audio Interface
  - Musician Setup: Main amplifier or instrument

- **INPUT**: Source devices
  - DJ: Players (CDJs, turntables, controllers)
  - Producer: Synthesizers, MIDI controllers
  - Musician: Instruments (guitars, basses, keyboards)

- **OUTPUT**: Output devices
  - DJ: Speakers, monitors
  - Producer: Studio monitors
  - Musician: Amplifiers, speakers

- **EFFECTS**: Effects processors
  - DJ: RMX units, FX processors
  - Producer: Effects units
  - Musician: Pedals, rack units

- **ACCESSORY**: Supporting equipment
  - Cables, headphones, stands, cases

### 2. Brain Device Logic

The "brain" device is the central hub of a setup:

- **DJ Setup**: The mixer (DJM) is the brain. All players connect to it.
- **Producer Setup**: The laptop or audio interface is the brain. Synthesizers and controllers connect to it.
- **Beginner DJ Setup**: Can have both a laptop (for software) and a mixer, where the laptop acts as a secondary brain.

### 3. Smart Placement Algorithm

When a device is added:

1. **Determine Role**: Identify the device's role based on its type and name
2. **Find Brain**: Check if a brain device already exists in the setup
3. **Calculate Position**: Use spot priorities to find the optimal position
4. **Validate**: Ensure the device can be placed (e.g., only one mixer for DJ)

## File Structure

### Core Utilities

- **`src/utils/devicePlacement.js`**
  - Device role determination
  - Brain device detection
  - Spot priority mapping
  - Position calculation
  - Setup readiness validation

- **`src/utils/productSearch.js`**
  - Product search in Firestore
  - Product-to-device conversion
  - Device validation
  - Setup compatibility checking

### Components

- **`src/components/SetupLandingPage.js`**
  - ChatGPT-like landing page
  - Saved setups sidebar
  - Search bar for adding devices
  - Quick suggestion chips

### Integration Points

- **`src/ThreeScene.js`**
  - Updated `getDevicePosition()` to use smart placement
  - Falls back to index-based placement if no spotType is provided

- **`src/App.js`**
  - Handles device addition from search
  - Manages setup state
  - Coordinates between landing page and 3D scene

## Usage Flow

### Adding a Device

1. User searches for a device in the landing page search bar
2. `handleAddDevice()` is called with the search query
3. `findProductByName()` searches Firestore for the product
4. `canAddProductToSetup()` validates the product can be added
5. `prepareProductForSetup()` creates a device object with:
   - Device metadata (name, type, brand, etc.)
   - Smart placement position (x, y, z, spotType)
   - Device role
6. Device is added to `actualDevices` state
7. ThreeScene receives the device and uses its `spotType` for positioning

### Placement Priority

For DJ setups:
- **Brain (Mixer)**: `middle` spot (center)
- **Input (Players)**: `middle_left`, `middle_right`, `far_left`, `far_right`
- **Effects**: `fx_top`, `fx_left`, `fx_right`, `fx_front`
- **Output**: `middle_back`
- **Accessories**: `middle_left_inner`, `middle_right_inner`

## Key Functions

### `getDeviceRole(device)`
Determines the role of a device based on its type and name.

### `findBrainDevice(devices, setupType)`
Finds the brain device in a setup. Returns null if none exists.

### `calculateOptimalSpot(device, setupType, existingDevices, availableSpots)`
Calculates the best spot for a device based on:
- Device role
- Existing devices and their positions
- Spot priorities for the setup type

### `getRecommendedPosition(device, setupType, existingDevices, spotConfig)`
Returns the recommended 3D position (x, y, z) and spotType for a device.

### `canAddProductToSetup(product, setupType, existingDevices)`
Validates if a product can be added to a setup. Checks:
- Setup type compatibility
- Duplicate brain devices (only one mixer for DJ, etc.)

## Example: Adding a CDJ-3000 to a DJ Setup

1. User searches "CDJ-3000"
2. Product found in Firestore
3. Role determined: `INPUT` (player)
4. Brain device check: Mixer exists at `middle` spot
5. Available player spots: `middle_left`, `middle_right`, `far_left`, `far_right`
6. First available: `middle_left` at position `{x: -0.8, y: 1.05, z: 0}`
7. Device created with `spotType: 'middle_left'`
8. ThreeScene places device at calculated position

## Future Enhancements

- **Connection Suggestions**: Automatically suggest cable connections based on device roles
- **Layout Optimization**: Rearrange devices for better spacing
- **Conflict Resolution**: Handle cases where multiple devices compete for the same spot
- **Visual Feedback**: Show placement preview before confirming
- **Undo/Redo**: Track placement history for easy reversion


