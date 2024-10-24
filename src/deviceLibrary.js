import * as THREE from 'three';

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
      { type: "Digital", coordinate: new THREE.Vector3(-0.36, 0.09, -0.34) }, // Example output coordinate
      { type: "Link", coordinate: new THREE.Vector3(-0.36, 0.09, -0.34) },        // Example output coordinate
      { type: "Line Out", coordinate: new THREE.Vector3(-0.36, 0.09, -0.34) }        // Example output coordinate
    ],
    connections: [
      {
        device: "DJM-900NXS2",
        cable: "Digital Cable",
        from: "Line Out",
        to: "Line3"
      },
      {
        device: "DJM-900NXS2",
        cable: "Digital Cable",
        from: "Line Out",
        to: "Line2"
      },
      {
        device: "DJM-900NXS2",
        cable: "Digital Cable",
        from: "Line Out",
        to: "Line4"
      },
      {
        device: "DJM-900NXS2",
        cable: "Digital Cable",
        from: "Line Out",
        to: "Line1"
      },
      // {
      //   device: "DJM-900NXS2",
      //   cable: "RCA Cable",
      //   from: "Line 1",
      //   to: "Line"
      // }
    ],
    price: 2299,
    locationPriority: 1000
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
      { type: "Line2", coordinate: new THREE.Vector3(-0.065, 0.09, -0.3) },
      { type: "Line1", coordinate: new THREE.Vector3(-0.12, 0.09, -0.3) },
      { type: "Line3", coordinate: new THREE.Vector3(-0.01, 0.09, -0.3) },
      { type: "Line4", coordinate: new THREE.Vector3(0.045, 0.09, -0.3) },
      // { type: "Phono", coordinate: new THREE.Vector3(-0.4, 0.2, 0.5) },
      // { type: "Digital", coordinate: new THREE.Vector3(-0.2, 0.04, -0.3) },
      // { type: "Mic", coordinate: new THREE.Vector3(-0.2, 0.2, 0.5) }
    ],
    outputs: [
      { type: "Master Out", coordinate: new THREE.Vector3(0.5, 0.2, 0.5) },
      { type: "Booth Out", coordinate: new THREE.Vector3(0.6, 0.2, 0.5) },
      { type: "Rec Out", coordinate: new THREE.Vector3(0.7, 0.2, 0.5) }
    ],
    connections: [],
    price: 2299,
    locationPriority: 0
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

export default deviceLibrary;