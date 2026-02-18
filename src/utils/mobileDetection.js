/**
 * Mobile Detection Utility
 * 
 * Provides comprehensive mobile device detection with specific support for:
 * - iPhone 16 Pro dimensions and Safari behavior
 * - Safe area considerations for notches
 * - Touch device detection
 * 
 * Created for mobile optimization of 3D React application
 */

/**
 * Detects if the current device is a mobile device
 * Uses multiple detection methods for accuracy
 * 
 * @returns {boolean} True if device is mobile
 */
export const isMobileDevice = () => {
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
  
  // Check screen width (iPhone 16 Pro is 393px in portrait, 852px in landscape)
  const isSmallScreen = window.innerWidth <= 768;
  
  // Check for touch capability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check if running in Safari on iOS
  const isIOSSafari = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  return (mobileRegex.test(userAgent) || (isSmallScreen && hasTouch)) || isIOSSafari;
};

/**
 * Detects if the current device is specifically an iPhone
 * 
 * @returns {boolean} True if device is an iPhone
 */
export const isIPhone = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /iPhone/.test(userAgent) && !window.MSStream;
};

/**
 * Detects if the browser is Safari (including iOS Safari)
 * 
 * @returns {boolean} True if browser is Safari
 */
export const isSafari = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /^((?!chrome|android).)*safari/i.test(userAgent) || 
         (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream);
};

/**
 * Detects if the device is an iPhone 16 Pro or similar modern iPhone
 * iPhone 16 Pro has dimensions: 393x852 (portrait), 852x393 (landscape)
 * 
 * @returns {boolean} True if device appears to be iPhone 16 Pro or similar
 */
export const isIPhone16Pro = () => {
  if (!isIPhone()) return false;
  
  // iPhone 16 Pro viewport dimensions
  // Portrait: 393px × 852px
  // Landscape: 852px × 393px
  const width = window.innerWidth;
  const height = window.innerHeight;
  
  // Check for iPhone 16 Pro dimensions (with some tolerance for browser chrome)
  const isPortrait = height > width;
  if (isPortrait) {
    // Portrait mode: width should be around 393px, height around 852px
    return width >= 375 && width <= 430 && height >= 800 && height <= 932;
  } else {
    // Landscape mode: width should be around 852px, height around 393px
    return width >= 800 && width <= 932 && height >= 375 && height <= 430;
  }
};

/**
 * Gets safe area insets for devices with notches (like iPhone)
 * Returns CSS safe-area-inset values
 * 
 * @returns {Object} Object with top, right, bottom, left safe area insets
 */
export const getSafeAreaInsets = () => {
  // Use CSS environment variables if available (iOS 11+)
  const style = getComputedStyle(document.documentElement);
  
  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0', 10) || 
         parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0', 10) || 0,
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0', 10) || 
            parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-right)') || '0', 10) || 0,
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0', 10) || 
            parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)') || '0', 10) || 0,
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0', 10) || 
          parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-left)') || '0', 10) || 0,
  };
};

/**
 * Gets device information object
 * 
 * @returns {Object} Device information including type, dimensions, and safe areas
 */
export const getDeviceInfo = () => {
  const mobile = isMobileDevice();
  const iphone = isIPhone();
  const safari = isSafari();
  const iphone16Pro = isIPhone16Pro();
  const safeAreas = getSafeAreaInsets();
  
  return {
    isMobile: mobile,
    isIPhone: iphone,
    isSafari: safari,
    isIPhone16Pro: iphone16Pro,
    width: window.innerWidth,
    height: window.innerHeight,
    safeAreas: safeAreas,
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape',
    pixelRatio: window.devicePixelRatio || 1
  };
};

/**
 * Hook-style function to use in React components
 * Returns device info and updates on resize/orientation change
 * Note: This requires React to be imported in the component using it
 * 
 * @param {Function} useState - React useState hook
 * @param {Function} useEffect - React useEffect hook
 * @returns {Object} Device information object
 */
export const createUseDeviceInfo = (useState, useEffect) => {
  return () => {
    const [deviceInfo, setDeviceInfo] = useState(() => getDeviceInfo());
    
    useEffect(() => {
      const updateDeviceInfo = () => {
        setDeviceInfo(getDeviceInfo());
      };
      
      // Update on resize
      window.addEventListener('resize', updateDeviceInfo);
      // Update on orientation change (important for mobile)
      window.addEventListener('orientationchange', updateDeviceInfo);
      
      return () => {
        window.removeEventListener('resize', updateDeviceInfo);
        window.removeEventListener('orientationchange', updateDeviceInfo);
      };
    }, []);
    
    return deviceInfo;
  };
};

// Export default for convenience
export default {
  isMobileDevice,
  isIPhone,
  isSafari,
  isIPhone16Pro,
  getSafeAreaInsets,
  getDeviceInfo,
  createUseDeviceInfo
};

