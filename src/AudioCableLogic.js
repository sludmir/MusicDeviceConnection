class AudioCableSystem {
    constructor() {
        // Cable types and their properties
        this.cableTypes = {
            // Analog cables
            "XLR": {
                balanced: true,
                connectorShape: "circular",
                pinCount: 3,
                commonUse: ["microphones", "mixers", "professional audio"],
                signalType: "analog",
                hasPhantomPower: true,
                maxLength: 100 // meters
            },
            "TRS": {
                balanced: true,
                connectorShape: "jack",
                sizes: ["1/4\"", "1/8\""],
                commonUse: ["instruments", "headphones", "studio monitors"],
                signalType: "analog",
                maxLength: 30 // meters
            },
            "TS": {
                balanced: false,
                connectorShape: "jack",
                sizes: ["1/4\"", "1/8\""],
                commonUse: ["guitars", "instruments", "unbalanced line"],
                signalType: "analog",
                maxLength: 6 // meters
            },
            "RCA": {
                balanced: false,
                connectorShape: "pin",
                commonUse: ["consumer audio", "DJ equipment", "video"],
                signalType: "analog",
                maxLength: 10 // meters
            },
            "TRRS": {
                balanced: false,
                connectorShape: "jack",
                sizes: ["1/8\""],
                commonUse: ["smartphones", "laptops", "headsets"],
                signalType: "analog",
                hasMic: true,
                maxLength: 3 // meters
            },
            // Digital cables
            "MIDI": {
                connectorShape: "din",
                pinCount: 5,
                commonUse: ["synths", "controllers", "drum machines"],
                signalType: "digital",
                maxLength: 15 // meters
            },
            "Optical": {
                connectorShape: "toslink",
                commonUse: ["home theater", "digital audio"],
                signalType: "digital",
                maxLength: 10 // meters
            },
            "HDMI": {
                connectorShape: "hdmi",
                commonUse: ["home theater", "video with audio"],
                signalType: "digital",
                hasVideo: true,
                maxLength: 15 // meters
            },
            "USB": {
                connectorShape: "usb",
                types: ["A", "B", "C", "Micro", "Mini"],
                commonUse: ["audio interfaces", "digital microphones"],
                signalType: "digital",
                hasPower: true,
                maxLength: 5 // meters
            }
        };

        // Device port types
        this.portTypes = {
            "XLR-F": { accepts: ["XLR"], gender: "female" },
            "XLR-M": { accepts: ["XLR"], gender: "male" },
            "TRS-1/4": { accepts: ["TRS-1/4", "TS-1/4"], gender: "female" },
            "TRS-1/8": { accepts: ["TRS-1/8", "TS-1/8", "TRRS-1/8"], gender: "female" },
            "TS-1/4": { accepts: ["TS-1/4"], gender: "female" },
            "TS-1/8": { accepts: ["TS-1/8"], gender: "female" },
            "RCA": { accepts: ["RCA"], gender: "female" },
            "MIDI-IN": { accepts: ["MIDI"], direction: "in", gender: "female" },
            "MIDI-OUT": { accepts: ["MIDI"], direction: "out", gender: "female" },
            "OPTICAL": { accepts: ["Optical"], gender: "female" },
            "HDMI": { accepts: ["HDMI"], gender: "female" },
            "USB-A": { accepts: ["USB-B", "USB-Micro", "USB-Mini"], gender: "female" },
            "USB-B": { accepts: ["USB-A"], gender: "female" },
            "USB-C": { accepts: ["USB-C"], gender: "female" }
        };

        // Audio device templates with ports
        this.deviceTemplates = {
            "mixer": {
                ports: {
                    inputs: [
                        { type: "XLR-F", count: 8, label: "Mic In" },
                        { type: "TRS-1/4", count: 8, label: "Line In" },
                        { type: "RCA", count: 2, label: "Stereo In" },
                        { type: "MIDI-IN", count: 1, label: "MIDI In" }
                    ],
                    outputs: [
                        { type: "XLR-M", count: 2, label: "Main Out" },
                        { type: "TRS-1/4", count: 4, label: "Aux Send" },
                        { type: "TRS-1/4", count: 1, label: "Headphone" },
                        { type: "MIDI-OUT", count: 1, label: "MIDI Out" }
                    ]
                }
            },
            "audio_interface": {
                ports: {
                    inputs: [
                        { type: "XLR-F", count: 2, label: "Mic In" },
                        { type: "TRS-1/4", count: 2, label: "Instrument/Line" },
                        { type: "MIDI-IN", count: 1, label: "MIDI In" }
                    ],
                    outputs: [
                        { type: "TRS-1/4", count: 2, label: "Monitor Out" },
                        { type: "TRS-1/4", count: 1, label: "Headphone" },
                        { type: "MIDI-OUT", count: 1, label: "MIDI Out" }
                    ],
                    digital: [
                        { type: "USB-B", count: 1, label: "USB" }
                    ]
                }
            },
            "guitar_amp": {
                ports: {
                    inputs: [
                        { type: "TS-1/4", count: 1, label: "Instrument In" },
                        { type: "TRS-1/8", count: 1, label: "Aux In" }
                    ],
                    outputs: [
                        { type: "TS-1/4", count: 1, label: "Line Out" },
                        { type: "XLR-M", count: 1, label: "DI Out" },
                        { type: "TRS-1/4", count: 1, label: "Headphone" }
                    ]
                }
            }
        };

        // Connected devices and cables
        this.devices = [];
        this.connections = [];

        // For ThreeJS visualization
        this.threeJSObjects = {};
    }

    // Create a device instance from a template
    createDevice(templateName, deviceName, position) {
        if (!this.deviceTemplates[templateName]) {
            console.error(`Template "${templateName}" not found`);
            return null;
        }

        const template = this.deviceTemplates[templateName];
        const device = {
            id: Date.now().toString(),
            name: deviceName,
            type: templateName,
            position: position || { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            ports: {
                inputs: [],
                outputs: [],
                digital: []
            }
        };

        // Create ports from template
        ['inputs', 'outputs', 'digital'].forEach(group => {
            if (template.ports[group]) {
                template.ports[group].forEach(portTemplate => {
                    for (let i = 0; i < portTemplate.count; i++) {
                        device.ports[group].push({
                            id: `${device.id}-${portTemplate.label}-${i}`,
                            type: portTemplate.type,
                            label: `${portTemplate.label} ${portTemplate.count > 1 ? i + 1 : ''}`,
                            isConnected: false,
                            position: { x: 0, y: 0, z: 0 } // Will be calculated in 3D space
                        });
                    }
                });
            }
        });

        this.devices.push(device);
        return device;
    }

    // Create a new cable
    createCable(cableType, size) {
        if (!this.cableTypes[cableType]) {
            console.error(`Cable type "${cableType}" not found`);
            return null;
        }

        // For TRS, TS, TRRS - size is required
        if (['TRS', 'TS', 'TRRS'].includes(cableType) && !size) {
            console.error(`Size is required for ${cableType} cables`);
            return null;
        }

        const cable = {
            id: Date.now().toString(),
            type: cableType,
            size: size,
            endpoints: [null, null],
            isConnected: false,
            length: 1, // Default length in meters
            color: this.getCableColor(cableType)
        };

        return cable;
    }

    // Get standard color for cable visualization
    getCableColor(cableType) {
        const cableColors = {
            "XLR": "#3d3d3d", // Dark gray
            "TRS": "#2a2a72", // Dark blue
            "TS": "#4d4d00", // Dark yellow
            "RCA": "#8b0000", // Dark red
            "TRRS": "#006400", // Dark green
            "MIDI": "#800080", // Purple
            "Optical": "#FF8C00", // Orange
            "HDMI": "#000000", // Black
            "USB": "#FFFFFF"  // White
        };

        return cableColors[cableType] || "#CCCCCC";
    }

    // Connect a cable between two device ports
    connectCable(cable, sourceDevice, sourcePortGroup, sourcePortIndex, destinationDevice, destPortGroup, destPortIndex) {
        // Get the source and destination ports
        const sourcePort = sourceDevice.ports[sourcePortGroup][sourcePortIndex];
        const destPort = destinationDevice.ports[destPortGroup][destPortIndex];

        // Check if ports exist
        if (!sourcePort || !destPort) {
            console.error("Invalid port selection");
            return false;
        }

        // Check if ports are already connected
        if (sourcePort.isConnected || destPort.isConnected) {
            console.error("Port is already connected");
            return false;
        }

        // Check compatibility
        if (!this.arePortsCompatible(sourcePort.type, destPort.type, cable.type, cable.size)) {
            console.error("Incompatible connection");
            return false;
        }

        // Create connection
        const connection = {
            id: Date.now().toString(),
            cable: cable,
            sourceDevice: sourceDevice.id,
            sourcePort: sourcePort.id,
            destinationDevice: destinationDevice.id,
            destinationPort: destPort.id
        };

        // Update port status
        sourcePort.isConnected = true;
        destPort.isConnected = true;
        cable.isConnected = true;
        cable.endpoints = [sourcePort.id, destPort.id];

        this.connections.push(connection);
        return connection;
    }

    // Check if two ports can be connected with the given cable
    arePortsCompatible(sourcePortType, destPortType, cableType, cableSize) {
        const sourcePortInfo = this.portTypes[sourcePortType];
        const destPortInfo = this.portTypes[destPortType];

        if (!sourcePortInfo || !destPortInfo) {
            return false;
        }

        // Check gender compatibility (typically we connect male to female)
        if (sourcePortInfo.gender === destPortInfo.gender) {
            return false;
        }

        // For MIDI, check direction compatibility
        if (cableType === "MIDI") {
            if (!(sourcePortInfo.direction === "out" && destPortInfo.direction === "in")) {
                return false;
            }
        }

        // Check if cable is accepted by both ports
        const fullCableType = cableSize ? `${cableType}-${cableSize}` : cableType;
        return sourcePortInfo.accepts.includes(fullCableType) &&
            destPortInfo.accepts.includes(fullCableType);
    }

    // Disconnect a cable
    disconnectCable(connectionId) {
        const connectionIndex = this.connections.findIndex(conn => conn.id === connectionId);

        if (connectionIndex === -1) {
            console.error("Connection not found");
            return false;
        }

        const connection = this.connections[connectionIndex];

        // Find devices and ports
        const sourceDevice = this.devices.find(device => device.id === connection.sourceDevice);
        const destDevice = this.devices.find(device => device.id === connection.destinationDevice);

        if (!sourceDevice || !destDevice) {
            console.error("Connected devices not found");
            return false;
        }

        // Find and update source port
        for (const group in sourceDevice.ports) {
            const port = sourceDevice.ports[group].find(p => p.id === connection.sourcePort);
            if (port) {
                port.isConnected = false;
                break;
            }
        }

        // Find and update destination port
        for (const group in destDevice.ports) {
            const port = destDevice.ports[group].find(p => p.id === connection.destinationPort);
            if (port) {
                port.isConnected = false;
                break;
            }
        }

        // Update cable status
        connection.cable.isConnected = false;
        connection.cable.endpoints = [null, null];

        // Remove connection
        this.connections.splice(connectionIndex, 1);
        return true;
    }

    // Calculate signal flow through connections
    analyzeSignalFlow() {
        // Create directed graph of connections
        const graph = {};
        this.devices.forEach(device => {
            graph[device.id] = [];
        });

        // Add connections to graph
        this.connections.forEach(conn => {
            graph[conn.sourceDevice].push({
                to: conn.destinationDevice,
                cable: conn.cable.type,
                quality: this.getConnectionQuality(conn)
            });
        });

        // Find all paths from each input device to each output device
        const paths = [];
        const inputDevices = this.devices.filter(d =>
            d.ports.outputs.some(p => p.isConnected));
        const outputDevices = this.devices.filter(d =>
            d.ports.inputs.some(p => p.isConnected));

        inputDevices.forEach(inputDevice => {
            outputDevices.forEach(outputDevice => {
                const devicePaths = this.findAllPaths(graph, inputDevice.id, outputDevice.id);
                paths.push(...devicePaths);
            });
        });

        return {
            paths,
            deviceCount: this.devices.length,
            connectionCount: this.connections.length
        };
    }

    // Find all possible signal paths between two devices
    findAllPaths(graph, start, end, visited = new Set(), path = [], allPaths = []) {
        visited.add(start);
        path.push(start);

        if (start === end) {
            allPaths.push([...path]);
        } else {
            for (const neighbor of graph[start]) {
                if (!visited.has(neighbor.to)) {
                    this.findAllPaths(graph, neighbor.to, end, visited, path, all// Find all possible signal paths between two devices
                findAllPaths(graph, start, end, visited = new Set(), path = [], allPaths = []) {
                        visited.add(start);
                        path.push(start);

                        if(start === end) {
                        allPaths.push([...path]);
                    } else {
                        for (const neighbor of graph[start]) {
                            if (!visited.has(neighbor.to)) {
                                this.findAllPaths(graph, neighbor.to, end, visited, path, allPaths);
                            }
                        }
                    }

                    // Backtrack
                    path.pop();
                    visited.delete(start);

                    return allPaths;
                }

                // Calculate connection quality based on cable type, length, and compatibility
                getConnectionQuality(connection) {
                    const cable = connection.cable;

                    // Base quality score
                    let quality = 100;

                    // Adjust for cable type
                    if (cable.type === "XLR" || cable.type === "TRS") {
                        // Professional balanced cables have best quality
                        quality += 10;
                    } else if (cable.type === "TS") {
                        // Unbalanced instrument cables lose some quality with length
                        quality -= Math.min(20, cable.length * 2);
                    } else if (cable.type === "RCA") {
                        // Consumer unbalanced cables lose more quality with length
                        quality -= Math.min(30, cable.length * 3);
                    }

                    // Digital cables either work perfectly or fail
                    if (["MIDI", "Optical", "HDMI", "USB"].includes(cable.type)) {
                        // Check if length exceeds recommended maximum
                        if (cable.length > this.cableTypes[cable.type].maxLength) {
                            quality = 0; // Digital signal failure
                        }
                    } else {
                        // Analog cables degrade with length
                        const maxLength = this.cableTypes[cable.type].maxLength;
                        const lengthFactor = cable.length / maxLength;

                        // Longer cables lose quality
                        quality -= Math.min(50, Math.floor(lengthFactor * 50));

                        // Balanced cables resist interference better
                        if (this.cableTypes[cable.type].balanced) {
                            quality += 15;
                        }
                    }

                    return Math.max(0, Math.min(100, quality));
                }

                // Implementation for Three.js integration
                initThreeJSScene(scene) {
                    this.scene = scene;
                    this.threeJSObjects = {
                        devices: {},
                        cables: {}
                    };

                    // Create 3D objects for devices
                    this.devices.forEach(device => {
                        this.createDeviceObject(device);
                    });

                    // Create 3D objects for connections
                    this.connections.forEach(connection => {
                        this.createConnectionObject(connection);
                    });
                }

                // Create 3D representation of a device
                createDeviceObject(device) {
                    // This implementation will depend on your Three.js setup
                    // Here's a simple placeholder that creates a box for each device

                    // Create device box
                    const deviceBox = new THREE.Group();
                    deviceBox.position.set(device.position.x, device.position.y, device.position.z);
                    deviceBox.rotation.set(device.rotation.x, device.rotation.y, device.rotation.z);

                    // Create main box
                    const geometry = new THREE.BoxGeometry(1, 0.2, 0.5);
                    const material = new THREE.MeshStandardMaterial({
                        color: 0x888888,
                        roughness: 0.7,
                        metalness: 0.3
                    });
                    const box = new THREE.Mesh(geometry, material);
                    deviceBox.add(box);

                    // Add device name label
                    const deviceLabel = this.createTextLabel(device.name, 0, 0.15, 0);
                    deviceBox.add(deviceLabel);

                    // Add port representations
                    this.createDevicePorts(device, deviceBox);

                    // Add to scene
                    this.scene.add(deviceBox);
                    this.threeJSObjects.devices[device.id] = deviceBox;

                    return deviceBox;
                }

                // Create 3D representations of device ports
                createDevicePorts(device, deviceObject) {
                    const portGroups = {
                        'inputs': { startZ: -0.25, color: 0x3355ff },
                        'outputs': { startZ: 0.25, color: 0xff5533 },
                        'digital': { startZ: 0, color: 0x33ff55 }
                    };

                    // Process each port group
                    Object.keys(portGroups).forEach(groupName => {
                        if (!device.ports[groupName]) return;

                        const portGroup = device.ports[groupName];
                        const groupSettings = portGroups[groupName];
                        const portCount = portGroup.length;

                        // Distribute ports along the appropriate device edge
                        portGroup.forEach((port, index) => {
                            // Calculate port position based on index and total count
                            const portX = (index / (portCount - 1 || 1) - 0.5) * 0.8;
                            const portZ = groupSettings.startZ;

                            // Create port object
                            const portGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 16);
                            const portMaterial = new THREE.MeshStandardMaterial({
                                color: groupSettings.color,
                                roughness: 0.5,
                                metalness: 0.7
                            });
                            const portObject = new THREE.Mesh(portGeometry, portMaterial);

                            // Position the port on the device
                            portObject.rotation.x = Math.PI / 2;
                            portObject.position.set(portX, 0, portZ);

                            // Store port position for cable connections
                            port.position = {
                                x: device.position.x + portX,
                                y: device.position.y,
                                z: device.position.z + portZ
                            };

                            // Add port label
                            const portLabel = this.createTextLabel(port.label, portX, 0.05, portZ);
                            portLabel.scale.set(0.5, 0.5, 0.5);

                            // Add port objects to device
                            deviceObject.add(portObject);
                            deviceObject.add(portLabel);
                        });
                    });
                }

                // Helper to create text labels (implementation depends on your Three.js text solution)
                createTextLabel(text, x, y, z) {
                    // This is a placeholder - implement with your preferred Three.js text solution
                    // (TextGeometry, CSS2DRenderer, HTML overlay, sprites, etc.)
                    const sprite = new THREE.Group();
                    sprite.position.set(x, y, z);
                    return sprite;
                }

                // Create 3D representation of a cable connection
                createConnectionObject(connection) {
                    // Find source and destination devices and ports
                    const sourceDevice = this.devices.find(d => d.id === connection.sourceDevice);
                    const destDevice = this.devices.find(d => d.id === connection.destinationDevice);

                    let sourcePort, destPort;

                    // Find the source port
                    for (const group in sourceDevice.ports) {
                        const foundPort = sourceDevice.ports[group].find(p => p.id === connection.sourcePort);
                        if (foundPort) {
                            sourcePort = foundPort;
                            break;
                        }
                    }

                    // Find the destination port
                    for (const group in destDevice.ports) {
                        const foundPort = destDevice.ports[group].find(p => p.id === connection.destinationPort);
                        if (foundPort) {
                            destPort = foundPort;
                            break;
                        }
                    }

                    if (!sourcePort || !destPort) {
                        console.error("Could not find connected ports");
                        return null;
                    }

                    // Get cable properties
                    const cable = connection.cable;
                    const cableColor = cable.color || this.getCableColor(cable.type);

                    // Create a curved path for the cable
                    const curve = this.createCableCurve(sourcePort.position, destPort.position);

                    // Create cable geometry and material
                    const cableGeometry = new THREE.TubeGeometry(
                        curve,
                        64,  // tubular segments
                        0.01, // cable radius
                        8,    // radial segments
                        false // closed
                    );

                    const cableMaterial = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(cableColor),
                        roughness: 0.7,
                        metalness: 0.3
                    });

                    const cableMesh = new THREE.Mesh(cableGeometry, cableMaterial);

                    // Add to scene
                    this.scene.add(cableMesh);
                    this.threeJSObjects.cables[connection.id] = cableMesh;

                    return cableMesh;
                }

                // Create a curve for the cable path
                createCableCurve(startPos, endPos) {
                    // Calculate control points for a natural cable curve
                    const midX = (startPos.x + endPos.x) / 2;
                    const midY = ((startPos.y + endPos.y) / 2) - 0.15; // Make cable hang down a bit
                    const midZ = (startPos.z + endPos.z) / 2;

                    // Create a quadratic bezier curve
                    const curve = new THREE.QuadraticBezierCurve3(
                        new THREE.Vector3(startPos.x, startPos.y, startPos.z),
                        new THREE.Vector3(midX, midY, midZ),
                        new THREE.Vector3(endPos.x, endPos.y, endPos.z)
                    );

                    return curve;
                }

                // Update the position/visibility of all 3D objects when scene changes
                updateThreeJSScene() {
                    // Update device positions
                    this.devices.forEach(device => {
                        const deviceObject = this.threeJSObjects.devices[device.id];
                        if (deviceObject) {
                            deviceObject.position.set(device.position.x, device.position.y, device.position.z);
                            deviceObject.rotation.set(device.rotation.x, device.rotation.y, device.rotation.z);
                        }
                    });

                    // Update cable connections
                    this.connections.forEach(connection => {
                        this.updateConnectionObject(connection);
                    });
                }

                // Update a cable connection visualization
                updateConnectionObject(connection) {
                    const cableMesh = this.threeJSObjects.cables[connection.id];
                    if (!cableMesh) return;

                    // Find source and destination ports
                    const sourceDevice = this.devices.find(d => d.id === connection.sourceDevice);
                    const destDevice = this.devices.find(d => d.id === connection.destinationDevice);

                    let sourcePort, destPort;

                    // Find the source port
                    for (const group in sourceDevice.ports) {
                        const foundPort = sourceDevice.ports[group].find(p => p.id === connection.sourcePort);
                        if (foundPort) {
                            sourcePort = foundPort;
                            break;
                        }
                    }

                    // Find the destination port
                    for (const group in destDevice.ports) {
                        const foundPort = destDevice.ports[group].find(p => p.id === connection.destinationPort);
                        if (foundPort) {
                            destPort = foundPort;
                            break;
                        }
                    }

                    // Update cable curve
                    const curve = this.createCableCurve(sourcePort.position, destPort.position);

                    // Update geometry
                    cableMesh.geometry.dispose();
                    cableMesh.geometry = new THREE.TubeGeometry(
                        curve,
                        64,  // tubular segments
                        0.01, // cable radius
                        8,    // radial segments
                        false // closed
                    );
                }

                // Export the current setup as JSON
                exportSetup() {
                    return {
                        devices: this.devices,
                        connections: this.connections.map(conn => ({
                            id: conn.id,
                            sourceDevice: conn.sourceDevice,
                            sourcePort: conn.sourcePort,
                            destinationDevice: conn.destinationDevice,
                            destinationPort: conn.destinationPort,
                            cableType: conn.cable.type,
                            cableSize: conn.cable.size,
                            cableLength: conn.cable.length,
                            cableColor: conn.cable.color
                        }))
                    };
                }

                // Import a setup from JSON
                importSetup(setupData) {
                    // Clear current setup
                    this.devices = [];
                    this.connections = [];

                    if (this.scene) {
                        // Remove 3D objects
                        Object.values(this.threeJSObjects.devices).forEach(obj => {
                            this.scene.remove(obj);
                        });
                        Object.values(this.threeJSObjects.cables).forEach(obj => {
                            this.scene.remove(obj);
                        });
                        this.threeJSObjects = {
                            devices: {},
                            cables: {}
                        };
                    }

                    // Import devices
                    setupData.devices.forEach(deviceData => {
                        this.devices.push(deviceData);
                    });

                    // Import connections
                    setupData.connections.forEach(connData => {
                        // Create cable
                        const cable = this.createCable(connData.cableType, connData.cableSize);
                        cable.length = connData.cableLength || 1;
                        cable.color = connData.cableColor || this.getCableColor(connData.cableType);

                        // Find devices
                        const sourceDevice = this.devices.find(d => d.id === connData.sourceDevice);
                        const destDevice = this.devices.find(d => d.id === connData.destinationDevice);

                        if (!sourceDevice || !destDevice) {
                            console.error("Could not find devices for connection");
                            return;
                        }

                        // Find ports
                        let sourcePortGroup, sourcePortIndex, destPortGroup, destPortIndex;

                        // Find source port
                        for (const group in sourceDevice.ports) {
                            const portIndex = sourceDevice.ports[group].findIndex(p => p.id === connData.sourcePort);
                            if (portIndex !== -1) {
                                sourcePortGroup = group;
                                sourcePortIndex = portIndex;
                                break;
                            }
                        }

                        // Find destination port
                        for (const group in destDevice.ports) {
                            const portIndex = destDevice.ports[group].findIndex(p => p.id === connData.destinationPort);
                            if (portIndex !== -1) {
                                destPortGroup = group;
                                destPortIndex = portIndex;
                                break;
                            }
                        }

                        if (sourcePortGroup && destPortGroup) {
                            // Connect cable
                            this.connectCable(
                                cable,
                                sourceDevice,
                                sourcePortGroup,
                                sourcePortIndex,
                                destDevice,
                                destPortGroup,
                                destPortIndex
                            );
                        }
                    });

                    // Recreate 3D objects if scene exists
                    if (this.scene) {
                        this.initThreeJSScene(this.scene);
                    }

                    return true;
                }
            }

            // Main controller class to handle user interaction with the system
            class AudioCableController {
                constructor(containerId) {
                    this.container = document.getElementById(containerId);
                    this.cableSystem = new AudioCableSystem();
                    this.selectedDevice = null;
                    this.selectedPort = null;
                    this.selectedCable = null;
                    this.connectionInProgress = false;

                    // ThreeJS properties
                    this.scene = null;
                    this.camera = null
                    // Main controller class to handle user interaction with the system
class AudioCableController {
    constructor(containerId) {
      this.container = document.getElementById(containerId);
      this.cableSystem = new AudioCableSystem();
      this.selectedDevice = null;
      this.selectedPort = null;
      this.selectedCable = null;
      this.connectionInProgress = false;
      
      // ThreeJS properties
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.controls = null;
      this.raycaster = null;
      this.mouse = null;
      
      // Initialize UI
      this.initUI();
      
      // Initialize ThreeJS scene
      this.initThreeJS();
      
      // Populate device options
      this.populateDeviceOptions();
    }
    
    // Initialize UI elements
    initUI() {
      // Create container for controls if it doesn't exist
      if (!this.container) {
        console.error("Container element not found");
        return;
      }
      
      // Clear container
      this.container.innerHTML = '';
      
      // Create control panels
      const controlPanel = document.createElement('div');
      controlPanel.className = 'audio-cable-controls';
      controlPanel.style.cssText = 'position: absolute; top: 10px; left: 10px; width: 300px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px;';
      
      // Add device controls
      const deviceControls = document.createElement('div');
      deviceControls.innerHTML = `
        <h3>Add Device</h3>
        <select id="device-template">
          <option value="">Select device type...</option>
        </select>
        <input id="device-name" placeholder="Device name" />
        <button id="add-device">Add Device</button>
        
        <h3>Add Cable</h3>
        <select id="cable-type">
          <option value="">Select cable type...</option>
        </select>
        <select id="cable-size" style="display:none;">
          <option value="">Select size...</option>
        </select>
        <button id="add-cable">Create Cable</button>
        
        <div id="connection-info" style="margin-top: 20px; display: none;">
          <h3>Connection</h3>
          <div id="connection-status"></div>
          <button id="cancel-connection">Cancel</button>
        </div>
      `;
      controlPanel.appendChild(deviceControls);
      
      this.container.appendChild(controlPanel);
      
      // Add event listeners
      document.getElementById('device-template').addEventListener('change', this.onDeviceTemplateChange.bind(this));
      document.getElementById('add-device').addEventListener('click', this.onAddDevice.bind(this));
      document.getElementById('cable-type').addEventListener('change', this.onCableTypeChange.bind(this));
      document.getElementById('add-cable').addEventListener('click', this.onAddCable.bind(this));
      document.getElementById('cancel-connection').addEventListener('click', this.onCancelConnection.bind(this));
      
      // Populate cable types dropdown
      const cableSelect = document.getElementById('cable-type');
      Object.keys(this.cableSystem.cableTypes).forEach(cableType => {
        const option = document.createElement('option');
        option.value = cableType;
        option.textContent = cableType;
        cableSelect.appendChild(option);
      });
    }
    
    // Initialize ThreeJS scene
    initThreeJS() {
      // Create scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x222222);
      
      // Create camera
      this.camera = new THREE.PerspectiveCamera(
        75, // Field of view
        this.container.clientWidth / this.container.clientHeight, // Aspect ratio
        0.1, // Near clipping plane
        1000 // Far clipping plane
      );
      this.camera.position.set(0, 1, 2);
      
      // Create renderer
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.shadowMap.enabled = true;
      this.container.appendChild(this.renderer.domElement);
      
      // Add orbit controls
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.25;
      
      // Setup raycasting for interaction
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      
      // Add event listeners for mouse interaction
      this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
      this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
      window.addEventListener('resize', this.onWindowResize.bind(this));
      
      // Add lighting
      this.addLights();
      
      // Add grid for reference
      const grid = new THREE.GridHelper(10, 10, 0x555555, 0x333333);
      this.scene.add(grid);
      
      // Start animation loop
      this.animate();
      
      // Initialize cableSystem with scene
      this.cableSystem.initThreeJSScene(this.scene);
    }
    
    // Add lights to the scene
    addLights() {
      // Ambient light
      const ambientLight = new THREE.AmbientLight(0x404040, 1);
      this.scene.add(ambientLight);
      
      // Directional light (like sunlight)
      const dirLight = new THREE.DirectionalLight(0xffffff, 1);
      dirLight.position.set(5, 5, 5);
      dirLight.castShadow = true;
      this.scene.add(dirLight);
      
      // Hemisphere light (sky and ground colors)
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
      this.scene.add(hemiLight);
    }
    
    // Animation loop
    animate() {
      requestAnimationFrame(this.animate.bind(this));
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
    
    // Populate device template options
    populateDeviceOptions() {
      const templateSelect = document.getElementById('device-template');
      templateSelect.innerHTML = '<option value="">Select device type...</option>';
      
      Object.keys(this.cableSystem.deviceTemplates).forEach(templateName => {
        const option = document.createElement('option');
        option.value = templateName;
        option.textContent = templateName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        templateSelect.appendChild(option);
      });
    }
    
    // Handle window resize
    onWindowResize() {
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    // Handle device template selection
    onDeviceTemplateChange() {
      // Any specific handling for device template changes can go here
    }
    
    // Handle cable type selection
    onCableTypeChange() {
      const cableType = document.getElementById('cable-type').value;
      const sizeSelect = document.getElementById('cable-size');
      
      // Reset and hide size select by default
      sizeSelect.innerHTML = '<option value="">Select size...</option>';
      sizeSelect.style.display = 'none';
      
      // Show size options for cable types that need them
      if (['TRS', 'TS', 'TRRS'].includes(cableType)) {
        const cableInfo = this.cableSystem.cableTypes[cableType];
        
        if (cableInfo.sizes) {
          cableInfo.sizes.forEach(size => {
            const option = document.createElement('option');
            option.value = size;
            option.textContent = size;
            sizeSelect.appendChild(option);
          });
          
          sizeSelect.style.display = 'block';
        }
      }
    }
    
    // Handle add device button click
    onAddDevice() {
      const templateName = document.getElementById('device-template').value;
      const deviceName = document.getElementById('device-name').value || templateName;
      
      if (!templateName) {
        alert('Please select a device type');
        return;
      }
      
      // Create a random position for the device
      const position = {
        x: (Math.random() - 0.5) * 4,
        y: 0,
        z: (Math.random() - 0.5) * 4
      };
      
      // Create the device
      const device = this.cableSystem.createDevice(templateName, deviceName, position);
      
      if (device) {
        // Create 3D representation
        const deviceObject = this.cableSystem.createDeviceObject(device);
        
        // Update UI
        this.updateUI();
      }
    }
    
    // Handle add cable button click
    onAddCable() {
      const cableType = document.getElementById('cable-type').value;
      const cableSize = document.getElementById('cable-size').style.display !== 'none' ?
                        document.getElementById('cable-size').value : null;
      
      if (!cableType) {
        alert('Please select a cable type');
        return;
      }
      
      if (['TRS', 'TS', 'TRRS'].includes(cableType) && !cableSize) {
        alert('Please select a cable size');
        return;
      }
      
      // Create the cable
      const cable = this.cableSystem.createCable(cableType, cableSize);
      
      if (cable) {
        // Start connection process
        this.selectedCable = cable;
        this.connectionInProgress = true;
        
        // Update UI to show connection in progress
        document.getElementById('connection-info').style.display = 'block';
        document.getElementById('connection-status').innerHTML = 
          `Select source port for ${cableType}${cableSize ? ' ' + cableSize : ''} cable`;
      }
    }
    
    // Handle cancel connection button click
    onCancelConnection() {
      this.selectedCable = null;
      this.selectedDevice = null;
      this.selectedPort = null;
      this.connectionInProgress = false;
      
      // Update UI
      document.getElementById('connection-info').style.display = 'none';
      this.updateUI();
    }
    
    // Handle mouse down on 3D scene
    onMouseDown(event) {
      // Calculate mouse position
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Raycast to find intersected objects
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // Get all device objects
      const deviceObjects = Object.values(this.cableSystem.threeJSObjects.devices);
      
      // Check for intersections with all meshes in device objects
      let intersects = [];
      deviceObjects.forEach(deviceObject => {
        deviceObject.traverse(child => {
          if (child.isMesh) {
            const childIntersects = this.raycaster.intersectObject(child);
            intersects = [...intersects, ...childIntersects];
          }
        });
      });
      
      if (intersects.length > 0) {
        // Find the first intersected device
        const intersectedObject = intersects[0].object;
        let deviceObject = intersectedObject;
        
        // Find parent device object
        while (deviceObject && !deviceObject.userData.deviceId) {
          deviceObject = deviceObject.parent;
        }
        
        if (deviceObject) {
          const deviceId = deviceObject.userData.deviceId;
          const device = this.cableSystem.devices.find(d => d.id === deviceId);
          
          // If we're connecting a cable
          if (this.connectionInProgress) {
            // Handle port selection for cable connection
            this.handlePortSelection(device, intersectedObject);
          } else {
            // Just select the device
            this.selectedDevice = device;
            this.updateUI();
          }
        }
      }
    }
    
    // Handle mouse move for highlighting
    onMouseMove(event) {
      // Similar logic to mouseDown but for highlighting
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      // Handle highlighting here
    }
    
    // Handle port selection for cable connections
    handlePortSelection(device, intersectedObject) {
      // Find which port was clicked
      let selectedPortGroup = null;
      let selectedPort = null;
      
      // Check if the object is a port
      if (intersectedObject.userData.portId) {
        const portId = intersectedObject.userData.portId;
        
        // Find which port group and port this belongs to
        for (const groupName in device.ports) {
          const portIndex = device.ports[groupName].findIndex(p => p.id === portId);
          if (portIndex !== -1) {
            selectedPortGroup = groupName;
            selectedPort = device.ports[groupName][portIndex];
            break;
          }
        }
      }
      
      if (selectedPort) {
        // Check if port is already connected
        if (selectedPort.isConnected) {
          alert("This port is already connected");
          return;
        }
        
        // If this is the first port selection
        if (!this.selectedDevice) {
          this.selectedDevice = device;
          this.selectedPort = { group: selectedPortGroup, port: selectedPort };
          
          // Update connection status
          document.getElementById('connection-status').innerHTML = 
            `${selectedPort.label} on ${device.name} selected. Now select destination port.`;
        } else {
          // This is the second port selection, complete the connection
          
          // Don't connect to the same device
          if (this.selectedDevice.id === device.id) {
            alert("Cannot connect a device to itself");
            return;
          }
          
          // Try to connect the cable
          const connection = this.cableSystem.connectCable(
            this.selectedCable,
            this.selectedDevice,
            this.selectedPort.group,
            this.selectedDevice.ports[this.selectedPort.group].indexOf(this.selectedPort.port),
            device,
            selectedPortGroup,
            device.ports[selectedPortGroup].indexOf(selectedPort)
          );
          
          if (connection) {
            // Create visual connection
            this.cableSystem.createConnectionObject(connection);
            
            // Reset connection state
            this.selectedCable = null;
            this.selectedDevice = null;
            this.selectedPort = null;
            this.connectionInProgress = false;
            
            // Update UI
            document.getElementById('connection-info').style.display = 'none';
            this.updateUI();
          } else {
            alert("These ports are not compatible");
          }
        }
      }
    }
    
    // Update UI base// Update UI based on current state
  updateUI() {
    // Update connection info if in progress
    if (this.connectionInProgress) {
      document.getElementById('connection-info').style.display = 'block';
      
      if (this.selectedDevice && this.selectedPort) {
        document.getElementById('connection-status').innerHTML = 
          `${this.selectedPort.port.label} on ${this.selectedDevice.name} selected. Now select destination port.`;
      } else {
        document.getElementById('connection-status').innerHTML = 
          `Select source port for ${this.selectedCable.type}${this.selectedCable.size ? ' ' + this.selectedCable.size : ''} cable`;
      }
    } else {
      document.getElementById('connection-info').style.display = 'none';
    }
    
    // Additional UI updates can be added here
    this.updateDeviceInfoPanel();
  }
  
  // Update device info panel when a device is selected
  updateDeviceInfoPanel() {
    // Remove existing panel if it exists
    const existingPanel = document.getElementById('device-info-panel');
    if (existingPanel) {
      existingPanel.remove();
    }
    
    // If no device is selected, don't show panel
    if (!this.selectedDevice && !this.connectionInProgress) {
      return;
    }
    
    // Create device info panel
    const infoPanel = document.createElement('div');
    infoPanel.id = 'device-info-panel';
    infoPanel.style.cssText = 'position: absolute; top: 10px; right: 10px; width: 300px; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px;';
    
    if (this.selectedDevice) {
      infoPanel.innerHTML = `
        <h3>${this.selectedDevice.name}</h3>
        <p>Type: ${this.selectedDevice.type}</p>
        
        <h4>Input Ports</h4>
        <ul>
          ${this.selectedDevice.ports.inputs.map(port => 
            `<li>${port.label} (${port.type}) - ${port.isConnected ? 'Connected' : 'Available'}</li>`
          ).join('')}
        </ul>
        
        <h4>Output Ports</h4>
        <ul>
          ${this.selectedDevice.ports.outputs.map(port => 
            `<li>${port.label} (${port.type}) - ${port.isConnected ? 'Connected' : 'Available'}</li>`
          ).join('')}
        </ul>
        
        ${this.selectedDevice.ports.digital && this.selectedDevice.ports.digital.length > 0 ? `
          <h4>Digital Ports</h4>
          <ul>
            ${this.selectedDevice.ports.digital.map(port => 
              `<li>${port.label} (${port.type}) - ${port.isConnected ? 'Connected' : 'Available'}</li>`
            ).join('')}
          </ul>
        ` : ''}
        
        <button id="move-device">Move Device</button>
        <button id="rotate-device">Rotate Device</button>
        <button id="remove-device">Remove Device</button>
      `;
    }
    
    this.container.appendChild(infoPanel);
    
    // Add event listeners for device actions
    if (this.selectedDevice) {
      document.getElementById('move-device').addEventListener('click', this.onMoveDevice.bind(this));
      document.getElementById('rotate-device').addEventListener('click', this.onRotateDevice.bind(this));
      document.getElementById('remove-device').addEventListener('click', this.onRemoveDevice.bind(this));
    }
  }
  
  // Handle move device button click
  onMoveDevice() {
    if (!this.selectedDevice) return;
    
    // Enter move mode
    this.moveMode = true;
    
    // Create a move plane to determine the new position
    const movePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    
    // Store reference to device object
    const deviceObject = this.cableSystem.threeJSObjects.devices[this.selectedDevice.id];
    
    // Add mouse move handler for drag operation
    const mouseMoveHandler = (e) => {
      if (!this.moveMode) return;
      
      // Calculate mouse position
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Raycast to the move plane
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(movePlane, intersects);
      
      if (intersects) {
        // Update device position
        this.selectedDevice.position.x = intersects.x;
        this.selectedDevice.position.z = intersects.z;
        
        // Update 3D object position
        deviceObject.position.set(intersects.x, 0, intersects.z);
        
        // Update port positions
        this.updatePortPositions(this.selectedDevice);
        
        // Update connected cables
        this.updateConnectedCables(this.selectedDevice);
      }
    };
    
    // Add mouse up handler to end move operation
    const mouseUpHandler = () => {
      this.moveMode = false;
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
    };
    
    // Add event listeners
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
    
    // Update UI
    this.updateUI();
  }
  
  // Update port positions when device is moved
  updatePortPositions(device) {
    const deviceObject = this.cableSystem.threeJSObjects.devices[device.id];
    
    // Update all port positions
    for (const groupName in device.ports) {
      device.ports[groupName].forEach(port => {
        // Find port object in device
        deviceObject.traverse(child => {
          if (child.userData && child.userData.portId === port.id && child.isMesh) {
            // Get port position in world space
            const portWorldPos = new THREE.Vector3();
            child.getWorldPosition(portWorldPos);
            
            // Update port position in data model
            port.position = {
              x: portWorldPos.x,
              y: portWorldPos.y,
              z: portWorldPos.z
            };
          }
        });
      });
    }
  }
  
  // Update connected cables when device is moved
  updateConnectedCables(device) {
    // Find all connections that involve this device
    const connections = this.cableSystem.connections.filter(conn => 
      conn.sourceDevice === device.id || conn.destinationDevice === device.id
    );
    
    // Update each connection
    connections.forEach(connection => {
      this.cableSystem.updateConnectionObject(connection);
    });
  }
  
  // Handle rotate device button click
  onRotateDevice() {
    if (!this.selectedDevice) return;
    
    // Rotate device by 90 degrees
    this.selectedDevice.rotation.y += Math.PI / 2;
    
    // Update 3D object rotation
    const deviceObject = this.cableSystem.threeJSObjects.devices[this.selectedDevice.id];
    deviceObject.rotation.y = this.selectedDevice.rotation.y;
    
    // Update port positions
    this.updatePortPositions(this.selectedDevice);
    
    // Update connected cables
    this.updateConnectedCables(this.selectedDevice);
    
    // Update UI
    this.updateUI();
  }
  
  // Handle remove device button click
  onRemoveDevice() {
    if (!this.selectedDevice) return;
    
    // Check if device has connections
    const connections = this.cableSystem.connections.filter(conn => 
      conn.sourceDevice === this.selectedDevice.id || conn.destinationDevice === this.selectedDevice.id
    );
    
    if (connections.length > 0) {
      if (!confirm(`This device has ${connections.length} connections. Remove anyway?`)) {
        return;
      }
      
      // Remove all connections first
      [...connections].forEach(connection => {
        this.cableSystem.disconnectCable(connection.id);
        
        // Remove 3D cable object
        const cableObject = this.cableSystem.threeJSObjects.cables[connection.id];
        if (cableObject) {
          this.scene.remove(cableObject);
          delete this.cableSystem.threeJSObjects.cables[connection.id];
        }
      });
    }
    
    // Remove device from system
    const deviceIndex = this.cableSystem.devices.findIndex(d => d.id === this.selectedDevice.id);
    if (deviceIndex !== -1) {
      this.cableSystem.devices.splice(deviceIndex, 1);
    }
    
    // Remove 3D device object
    const deviceObject = this.cableSystem.threeJSObjects.devices[this.selectedDevice.id];
    if (deviceObject) {
      this.scene.remove(deviceObject);
      delete this.cableSystem.threeJSObjects.devices[this.selectedDevice.id];
    }
    
    // Reset selection
    this.selectedDevice = null;
    
    // Update UI
    this.updateUI();
  }
  
  // Export the current setup
  exportSetup() {
    const setup = this.cableSystem.exportSetup();
    return JSON.stringify(setup, null, 2);
  }
  
  // Import a setup
  importSetup(setupJson) {
    try {
      const setup = JSON.parse(setupJson);
      this.cableSystem.importSetup(setup);
      this.updateUI();
      return true;
    } catch (error) {
      console.error("Error importing setup", error);
      return false;
    }
  }
  
  // Analyze the current signal flow
  analyzeSignalFlow() {
    const analysis = this.cableSystem.analyzeSignalFlow();
    
    // Create an analysis panel to display results
    const analysisPanel = document.createElement('div');
    analysisPanel.className = 'signal-flow-analysis';
    analysisPanel.style.cssText = 'position: absolute; bottom: 10px; left: 10px; width: 500px; max-height: 300px; overflow-y: auto; background: rgba(0,0,0,0.7); color: white; padding: 10px; border-radius: 5px;';
    
    let content = `
      <h3>Signal Flow Analysis</h3>
      <p>Total devices: ${analysis.deviceCount}</p>
      <p>Total connections: ${analysis.connectionCount}</p>
    `;
    
    if (analysis.paths.length > 0) {
      content += `<h4>Signal Paths</h4><ul>`;
      
      analysis.paths.forEach((path, index) => {
        content += `<li>Path ${index + 1}: `;
        
        const pathDevices = path.map(deviceId => {
          const device = this.cableSystem.devices.find(d => d.id === deviceId);
          return device ? device.name : deviceId;
        });
        
        content += pathDevices.join(' → ');
        content += '</li>';
      });
      
      content += `</ul>`;
    } else {
      content += `<p>No complete signal paths found.</p>`;
    }
    
    analysisPanel.innerHTML = content;
    
    // Remove existing analysis panel if any
    const existingPanel = document.querySelector('.signal-flow-analysis');
    if (existingPanel) {
      existingPanel.remove();
    }
    
    this.container.appendChild(analysisPanel);
    
    // Add close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.marginTop = '10px';
    closeButton.addEventListener('click', () => {
      analysisPanel.remove();
    });
    analysisPanel.appendChild(closeButton);
    
    return analysis;
  }
}

// Factory module for creating audio cable system objects
const AudioCableFactory = {
  createController(containerId) {
    return new AudioCableController(containerId);
  },
  
  createSystem() {
    return new AudioCableSystem();
  }
};

// Export for use in modules
export default AudioCableFactory;