// Message types for communication between content script and background script

type BackgroundRequestDataPlaceholder = Record<string, never>;

export type TTSSpeakRequest = {
  type: 'TTS_SPEAK_REQUEST';
  data: {
    text: string;
    voiceURI: string | null;
    volume?: number;
    requestId: string;
  };
};

export type TTSCancelRequest = {
  type: 'TTS_CANCEL_REQUEST';
  data?: BackgroundRequestDataPlaceholder;
};

export type TTSCancelResponse = {
  type: 'TTS_CANCEL_RESPONSE';
  data: {
    success: boolean;
  };
};

export type TTSSpeakResponse = {
  type: 'TTS_SPEAK_RESPONSE';
  data: {
    requestId: string;
    type: 'end' | 'cancelled' | 'error' | 'interrupted';
    success: boolean;
    error?: string;
  };
};

// Union type for all background messages
export type BackgroundRequest = TTSSpeakRequest | TTSCancelRequest;
export type BackgroundRequestType = BackgroundRequest['type'];
export type TTSResponse = TTSSpeakResponse | TTSCancelResponse;
export type TTSResponseType = TTSResponse['type'];

// Type mapping from Request to corresponding Response
export type BackgroundRequestResponseMap = {
  TTS_SPEAK_REQUEST: TTSSpeakResponse;
  TTS_CANCEL_REQUEST: TTSCancelResponse;
};

// Utility type to infer Response type from Request type
export type InferBackgroundResponse<T extends BackgroundRequest> = T extends { type: infer K }
  ? K extends keyof BackgroundRequestResponseMap
    ? BackgroundRequestResponseMap[K]
    : never
  : never;
