import { GoogleGenAI, Type } from "@google/genai";
import type { TranscriptionResult } from '../types/transcription';

// Using the same API key as the live audio system
const GEMINI_API_KEY = 'AIzaSyAUHP34aS7UPglJDl64pub4kR7m59IZcTw';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // remove the data url prefix
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
};

const systemInstruction = `You are an expert multilingual speech-to-text transcriber and task identification AI. Your primary function is to listen to an audio clip, transcribe it to English, and determine if it contains a command, including indirect ones.

1.  **Transcribe:** Transcribe the audio content into English, regardless of the original language.
2.  **Analyze & Format:** Analyze the transcription for commands and format the output as a specific JSON object.

**JSON Output Rules:**

Your entire response MUST be a valid JSON object with two keys: "transcription" and "task".

*   **"transcription"**: (string) The English transcription of the audio.
*   **"task"**: (object) An object representing the identified command.

**'task' Object Formatting:**

*   **No Command:** If the speech is conversational, a question, or not a command, the task object MUST be:
    \`{ "type": "none" }\`

*   **Direct/Indirect Commands:** If a command is identified, structure the task object based on the command category. Use these exact formats:

    *   **Open Application:** For "open youtube", "start spotify".
        \`{ "type": "open_app", "payload": { "name": "youtube" } }\`

    *   **Set Timer/Reminder:** For "remind me in 10 minutes", "set a timer for 5 mins".
        \`{ "type": "timer", "payload": { "duration": "10 minutes" } }\`

    *   **Environment Control:** For indirect commands like "I'm feeling cold", "it's too bright", "set a romantic mood".
        - "I'm feeling cold" -> \`{ "type": "environment_control", "payload": { "device": "thermostat", "action": "increase_temperature" } }\`
        - "I'm feeling hot" -> \`{ "type": "environment_control", "payload": { "device": "thermostat", "action": "decrease_temperature" } }\`
        - "The room is too bright" -> \`{ "type": "environment_control", "payload": { "device": "lights", "action": "dim" } }\`
        - "Set a romantic mood" -> \`{ "type": "environment_control", "payload": { "device": "lights", "action": "set_scene", "value": "romantic" } }\`

    *   **Information/Service Request:** For "I'm hungry", "show me the hotel menu".
        - "I'm hungry" or "show menu" -> \`{ "type": "service_request", "payload": { "request": "view_menu" } }\`

Your entire response must be ONLY the JSON object and nothing else.`;

export const transcribeAndIdentifyTask = async (audioBlob: Blob): Promise<TranscriptionResult> => {
  try {
    const base64Audio = await blobToBase64(audioBlob);

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{
            parts: [{
                inlineData: {
                    mimeType: "audio/webm",
                    data: base64Audio,
                }
            }]
        }],
        config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    transcription: {
                        type: Type.STRING,
                        description: "The English transcription of the audio."
                    },
                    task: {
                        type: Type.OBJECT,
                        description: "The identified command object.",
                        properties: {
                            type: {
                                type: Type.STRING,
                                description: "The category of the command (e.g., 'none', 'open_app', 'timer')."
                            },
                            payload: {
                                type: Type.OBJECT,
                                description: "An object containing command-specific details.",
                                properties: {
                                    name: { type: Type.STRING, description: "Name of the app to open." },
                                    duration: { type: Type.STRING, description: "Duration for a timer." },
                                    device: { type: Type.STRING, description: "Device for environment control." },
                                    action: { type: Type.STRING, description: "Action for environment control." },
                                    value: { type: Type.STRING, description: "Value for an action (e.g., scene name)." },
                                    request: { type: Type.STRING, description: "The specific service request." }
                                }
                            }
                        },
                        required: ["type"]
                    }
                },
                required: ["transcription", "task"]
            },
        },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText) as TranscriptionResult;
    
    if(!result || typeof result.transcription !== 'string' || typeof result.task?.type !== 'string') {
        throw new Error('Invalid JSON response format from API.');
    }
    
    return result;

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Gemini API Error: ${error.message}`);
    }
    throw new Error("An unexpected error occurred while communicating with the Gemini API.");
  }
};