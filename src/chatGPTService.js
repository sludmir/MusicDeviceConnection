import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // Only use this in development
});

/**
 * Get connection suggestions for a set of music products
 * @param {Array} products - Array of product objects with their details
 * @returns {Promise<string>} - Connection suggestions from ChatGPT
 */
export const getConnectionSuggestions = async (products) => {
  try {
    // Create a prompt that describes the products and asks for connection suggestions
    const prompt = `Analyze these devices and provide optimal connections: ${JSON.stringify(products, null, 2)}

Provide numbered steps using format: "Device1 Port1 to Device2 Port2 (CableType)"
Examples:
1. Player Line1 to Mixer Line1 (RCA)
2. Player1 LINK to Player2 LINK (Ethernet)
3. Mixer Master to Speakers (XLR)
4. Synth Out to Interface In (1/4")

Determine connections based on device types, inputs/outputs, and standard audio setup practices. Keep under 100 words.`;

    // Call the ChatGPT API
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an audio engineer. Analyze the provided devices and determine optimal connections based on their types, inputs/outputs, and standard audio setup practices. Use format: 'Device1 Port1 to Device2 Port2 (CableType)'. Be specific about ports and cables."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error getting connection suggestions:', error);
    throw new Error('Failed to get connection suggestions');
  }
};

/**
 * Validate if a connection between two devices is possible
 * @param {Object} device1 - First device object
 * @param {Object} device2 - Second device object
 * @returns {Promise<boolean>} - Whether the connection is possible
 */
export const validateConnection = async (device1, device2) => {
  try {
    const prompt = `Can these two devices be connected directly?
    Device 1: ${JSON.stringify(device1)}
    Device 2: ${JSON.stringify(device2)}
    
    Please respond with a simple yes or no, followed by a brief explanation if needed.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional audio engineer. Provide clear, concise answers about device compatibility."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 150
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error validating connection:', error);
    throw new Error('Failed to validate connection');
  }
}; 