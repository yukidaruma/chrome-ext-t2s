// Message types for communication between content script and background script

type TTSRequestDataPlaceholder = Record<string, never>;

export type TTSSpeakRequest = {
  type: 'TTS_SPEAK';
  data: {
    text: string;
    voiceURI: string | null;
    volume?: number;
    requestId: string;
  };
};

export type TTSCancelRequest = {
  type: 'TTS_CANCEL';
  data?: TTSRequestDataPlaceholder;
};

export type TTSCancelResponse = {
  type: 'TTS_CANCEL_RESPONSE';
  data: {
    success: boolean;
  };
};

export type TTSSpeakResponse = {
  type: 'TTS_RESPONSE';
  data: {
    requestId: string;
    type: 'end' | 'cancelled' | 'error' | 'interrupted';
    success: boolean;
    error?: string;
  };
};

// Union type for all TTS-related messages
export type TTSRequest = TTSSpeakRequest | TTSCancelRequest;
export type TTSRequestType = TTSRequest['type'];
export type TTSResponse = TTSSpeakResponse | TTSCancelResponse;
export type TTSResponseType = TTSResponse['type'];

// Type mapping from Request to corresponding Response
export type TTSRequestResponseMap = {
  TTS_SPEAK: TTSSpeakResponse;
  TTS_CANCEL: TTSCancelResponse;
};

// Utility type to infer Response type from Request type
export type InferTTSResponse<T extends TTSRequest> = T extends { type: infer K }
  ? K extends keyof TTSRequestResponseMap
    ? TTSRequestResponseMap[K]
    : never
  : never;
