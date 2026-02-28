import type { VsCodeApi } from './types'

function getVscodeApi(): VsCodeApi | null {
  /**
   * Retrieves the VS Code API instance if running as an extension within VS Code.
   *
   * This function checks whether the `acquireVsCodeApi` function is available in the current environment.
   * When running as a VS Code extension (webview), it returns the API object that enables communication
   * with the extension host via postMessage. When running as a standalone web application in a browser,
   * it returns null since the VS Code API is unavailable.
   *
   * @returns {VsCodeApi | null} The VS Code API object if available, otherwise null
   */
  if (typeof acquireVsCodeApi !== 'undefined') {
    return acquireVsCodeApi()
  }
  return null
}

const vscode = getVscodeApi()

export function sendMessage(command: string, data?: any) {
  if (vscode) {
    vscode.postMessage({ command, ...data })
  }
}

export function onMessage(callback: (data: any) => void) {
  window.addEventListener('message', function (event) {
    callback(event.data)
  })
}

export function saveAuth(token: string, user: any) {
  sendMessage('saveAuth', { token, user })
}

export function getAuth() {
  sendMessage('getAuth')
}

export function logout() {
  sendMessage('logout')
}
