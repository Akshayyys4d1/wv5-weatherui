export interface Task {
  type: 'none' | 'open_app' | 'timer' | 'environment_control' | 'service_request';
  payload?: {
    name?: string;
    duration?: string;
    device?: string;
    action?: string;
    value?: string;
    request?: string;
  };
}

export interface TranscriptionResult {
  transcription: string;
  task: Task;
}