# Adding Teile2 Revolo as FX Unit

## ✅ Completed Steps

1. **Model File**: Copied `small_Teile_Revolo.glb` to `/public/models/RENDERS/`
2. **Device Placement**: Updated `devicePlacement.js` to recognize `fx` type as EFFECTS role
3. **Product Script**: Created `addTeileRevolo.js` script

## How to Add the Product

### Option 1: Using Browser Console (Recommended)

1. Start your app: `npm start`
2. Open the browser console (F12)
3. Copy and paste this code:

```javascript
// Import productManager
const { productManager } = await import('./src/productManager.js');

// Product data
const productData = {
  name: "Teile2 Revolo",
  type: "fx_unit",
  brand: "Revolo",
  description: "FX unit for DJ setups",
  category: "DJ",
  subcategory: "effects",
  price: 0,
  locationPriority: 1000,
  inputs: [
    { type: "Return In", coordinate: { x: -0.065, y: 0.09, z: -0.3 } },
    { type: "Send In", coordinate: { x: -0.12, y: 0.09, z: -0.3 } }
  ],
  outputs: [
    { type: "Return Out", coordinate: { x: 0.5, y: 0.2, z: 0.5 } },
    { type: "Send Out", coordinate: { x: 0.6, y: 0.2, z: 0.5 } }
  ],
  connections: [],
  specifications: {},
  features: [],
  modelPath: "/models/RENDERS/small_Teile_Revolo.glb",
  isActive: true,
  setupTypes: ["DJ"]
};

// Add to Firestore
const result = await productManager.addProduct(productData);
console.log(result.success ? '✅ Added successfully!' : '❌ Error: ' + result.error);
```

### Option 2: Using Product Dashboard UI

1. Sign in to your app
2. Click your profile → Product Management
3. Add a new product with these details:
   - **Name**: Teile2 Revolo
   - **Type**: fx_unit
   - **Brand**: Revolo
   - **Category**: DJ
   - **Subcategory**: effects
   - **Model Path**: /models/RENDERS/small_Teile_Revolo.glb
   - **Price**: (set as needed)

## FX Spot Placement

The device will automatically be placed in FX-specific spots:
- `fx_top` - Top position
- `fx_left` - Left side
- `fx_right` - Right side  
- `fx_front` - Front position

These spots are available in DJ setups after the basic setup (mixer + players) is complete.

## Verification

After adding, search for "Teile2 Revolo" in your app and add it to a DJ setup. It should appear in the FX device category and be placeable in any FX spot.
