import type { VsCodeApi } from './types';

function getVscodeApi(): VsCodeApi | null {
  if (typeof acquireVsCodeApi !== 'undefined') {
    return acquireVsCodeApi();
  }
  return null;
}

const vscode = getVscodeApi();

export function sendMessage(command: string, data?: any) {
  if (vscode) {
    vscode.postMessage({ command, ...data });
  }
}

export function onMessage(callback: (data: any) => void) {
  window.addEventListener('message', function(event) {
    callback(event.data);
  });
}

export function saveAuth(token: string, user: any) {
  sendMessage('saveAuth', { token, user });
}

export function getAuth() {
  sendMessage('getAuth');
}

export function logout() {
  sendMessage('logout');
}
