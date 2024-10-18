import * as THREE from 'three';

const CDJ3000Connections = {
  digitalOut: new THREE.Vector3(0.1, 0.25, 0.5),  // Moved up and slightly to the right
  lineOut: new THREE.Vector3(-0.1, 0.25, 0.5),    // Moved up and slightly to the left
};

const DJM900Connections = {
  ch1Digital: new THREE.Vector3(-0.4, 0.2, 0.5),  // Moved up
  ch1Line: new THREE.Vector3(-0.3, 0.2, 0.5),     // Moved up
  ch2Digital: new THREE.Vector3(-0.1, 0.2, 0.5),  // Moved up
  ch2Line: new THREE.Vector3(0, 0.2, 0.5),        // Moved up
  ch3Digital: new THREE.Vector3(0.1, 0.2, 0.5),   // Moved up
  ch3Line: new THREE.Vector3(0.2, 0.2, 0.5),      // Moved up
  ch4Digital: new THREE.Vector3(0.3, 0.2, 0.5),   // Moved up
  ch4Line: new THREE.Vector3(0.4, 0.2, 0.5),      // Moved up
  headphones: new THREE.Vector3(0, -0.2, 0.3),
};

const deviceLibrary = {
  // // CDJs
  "CDJ-3000": {
    name: "CDJ-3000",
    type: "player",
    brand: "Pioneer DJ",
    description: "Flagship professional DJ multi player",
    modelPath: "/models/RENDERS/CDJ3000(v1).glb",
    inputs: [
      { type: "USB", coordinate: new THREE.Vector3(-0.5, 0.2, 0.5) }, // Example input coordinate
      { type: "SD", coordinate: new THREE.Vector3(-0.4, 0.2, 0.5) },  // Example input coordinate
      { type: "Link", coordinate: new THREE.Vector3(-0.3, 0.2, 0.5) }  // Example input coordinate
    ],
    outputs: [
      { type: "Digital Out", coordinate: new THREE.Vector3(-0.18, 0.045, -0.17) }, // Example output coordinate
      { type: "Link", coordinate: new THREE.Vector3(0.6, 0.2, 0.5) },        // Example output coordinate
      { type: "Line 1", coordinate: new THREE.Vector3(0.6, 0.2, 0.5) }        // Example output coordinate
    ],
    connections: [
      {
        device: "DJM-900NXS2",
        cable: "Digital Cable",
        from: "Digital Out",
        to: "Digital"
      },
      // {
      //   device: "DJM-900NXS2",
      //   cable: "RCA Cable",
      //   from: "Line 1",
      //   to: "Line"
      // }
    ],
    price: 2299
  },
  // "CDJ-2000NXS2": {
  //   name: "CDJ-2000NXS2",
  //   type: "player",
  //   brand: "Pioneer DJ",
  //   description: "Professional DJ multi player",
  //   modelPath: "/models/RENDERS/pioneer_cdj_2000nxs2.glb",
  //   inputs: ["USB", "SD", "Link"],
  //   outputs: ["Digital Out", "Link"],
  //   connections: [
  //     { 
  //       device: "DJM-900NXS2", 
  //       cable: "Digital Cable", 
  //       from: "digitalOut",
  //       to: "ch2Digital"
  //     },
  //     { 
  //       device: "DJM-900NXS2", 
  //       cable: "RCA Cable", 
  //       from: "lineOut",
  //       to: "ch2Line"
  //     }
  //   ],
  //   price: 2199
  // },
  // "CDJ-3000-W": {
  //   name: "CDJ-3000-W",
  //   type: "player",
  //   brand: "Pioneer DJ",
  //   description: "White version of the CDJ-3000",
  //   modelPath: "/models/RENDERS/cdj_3000_w.glb",
  //   inputs: ["USB", "SD", "Link"],
  //   outputs: ["Digital Out", "Link"],
  //   connections: [
  //     { 
  //       device: "DJM-900NXS2", 
  //       cable: "Digital Cable", 
  //       from: "digitalOut",
  //       to: "ch3Digital"
  //     },
  //     { 
  //       device: "DJM-900NXS2", 
  //       cable: "RCA Cable", 
  //       from: "lineOut",
  //       to: "ch3Line"
  //     }
  //   ],
  //   price: 2299
  // },

  // // Mixers
  "DJM-900NXS2": {
    name: "DJM-900NXS2",
    type: "mixer",
    brand: "Pioneer DJ",
    description: "4-channel professional DJ mixer",
    modelPath: "/models/RENDERS/DJM900(v2).glb",
    inputs: [
      { type: "Line", coordinate: new THREE.Vector3(-0.5, 0.2, 0.5) },
      { type: "Phono", coordinate: new THREE.Vector3(-0.4, 0.2, 0.5) },
      { type: "Digital", coordinate: new THREE.Vector3(-0.1, 0.02, -0.15) },
      { type: "Mic", coordinate: new THREE.Vector3(-0.2, 0.2, 0.5) }
    ],
    outputs: [
      { type: "Master Out", coordinate: new THREE.Vector3(0.5, 0.2, 0.5) },
      { type: "Booth Out", coordinate: new THREE.Vector3(0.6, 0.2, 0.5) },
      { type: "Rec Out", coordinate: new THREE.Vector3(0.7, 0.2, 0.5) }
    ],
    connections: [],
    price: 2299
  },
  // "DJM-750MK2": {
  //   name: "DJM-750MK2",
  //   type: "mixer",
  //   brand: "Pioneer DJ",
  //   description: "4-channel digital DJ mixer",
  //   modelPath: "/models/RENDERS/djm_750mk2.glb",
  //   inputs: ["Line", "Phono", "Digital", "Mic"],
  //   outputs: ["Master Out", "Booth Out"],
  //   connections: [],
  //   price: 1199
  // },
  // "DJM-V10": {
  //   name: "DJM-V10",
  //   type: "mixer",
  //   brand: "Pioneer DJ",
  //   description: "6-channel professional DJ mixer",
  //   modelPath: "/models/RENDERS/djm_v10.glb",
  //   inputs: ["Line", "Phono", "Digital", "Mic"],
  //   outputs: ["Master Out", "Booth Out", "Zone Out"],
  //   connections: [],
  //   price: 3199
  // },

  // // Headphones
  // "HDJ-X10": {
  //   name: "HDJ-X10",
  //   type: "headphones",
  //   brand: "Pioneer DJ",
  //   description: "Flagship professional over-ear DJ headphones",
  //   modelPath: "/models/RENDERS/hdj_x10.glb",
  //   inputs: ["3.5mm Jack", "6.3mm Jack"],
  //   outputs: [],
  //   connections: [
  //     { 
  //       device: "DJM-900NXS2", 
  //       cable: "Headphone Cable", 
  //       from: "output",
  //       to: "headphones"
  //     }
  //   ],
  //   price: 349
  // },
  // "HDJ-X7": {
  //   name: "HDJ-X7",
  //   type: "headphones",
  //   brand: "Pioneer DJ",
  //   description: "Professional over-ear DJ headphones",
  //   modelPath: "/models/RENDERS/hdj_x7.glb",
  //   inputs: ["3.5mm Jack", "6.3mm Jack"],
  //   outputs: [],
  //   connections: [
  //     { 
  //       device: "DJM-750MK2", 
  //       cable: "Headphone Cable", 
  //       from: "output",
  //       to: "headphones"
  //     }
  //   ],
  //   price: 199
  // },
  // "HDJ-X5": {
  //   name: "HDJ-X5",
  //   type: "headphones",
  //   brand: "Pioneer DJ",
  //   description: "Over-ear DJ headphones",
  //   modelPath: "/models/RENDERS/hdj_x5.glb",
  //   inputs: ["3.5mm Jack"],
  //   outputs: [],
  //   connections: [
  //     { 
  //       device: "DJM-250MK2", 
  //       cable: "Headphone Cable", 
  //       from: "output",
  //       to: "headphones"
  //     }
  //   ],
  //   price: 99
  // }
};

export { CDJ3000Connections, DJM900Connections };
export default deviceLibrary;