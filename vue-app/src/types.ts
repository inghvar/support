export interface VsCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  is_staff: boolean;
}

export interface LoginResponse {
  user: User;
  token: string;
}

declare global {
  function acquireVsCodeApi(): VsCodeApi;
}
