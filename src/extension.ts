// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "toolpath" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerCommand('toolpath.helloWorld', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Hello World from toolpath!');
	});

	// Register command to open webview with Vue form
	const openFormCommand = vscode.commands.registerCommand('toolpath.openForm', () => {
		const panel = vscode.window.createWebviewPanel(
			'toolpathForm',
			'Toolpath Form',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
			}
		);

		const htmlContent = getWebviewContent(panel.webview, context.extensionPath);
		panel.webview.html = htmlContent;

        panel.webview.onDidReceiveMessage(
	        async function(message) {
            if (message.command === 'saveAuth') {
                await context.secrets.store('authToken', message.token);
                await context.globalState.update('user', message.user);
                console.log('Saved token:', message.token);
                console.log('Saved user:', JSON.stringify(message.user));
                vscode.window.showInformationMessage('Successfully logged in!');
                panel.webview.postMessage({
                    command: 'authSaved',
                    success: true
                });
            }
        
            if (message.command === 'getAuth') {
                    await getAuth(panel, context);
            }
        
            if (message.command === 'logout') {
                await context.secrets.delete('authToken');
                await context.globalState.update('user', undefined);
                vscode.window.showInformationMessage('Logged out');
                panel.webview.postMessage({
                    command: 'loggedOut',
                    success: true
                });
            }

            if (message.command === 'saveGcodeFile') {
                const content = message.gcode;
                const fileName = message.fileName;
                const uri = await vscode.window.showSaveDialog({
                    filters: { 'G-code': ['gcode', 'nc'] },
                    defaultUri: vscode.Uri.file(fileName),
                    saveLabel: 'Save'
                });
                if (!uri) return;
                await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
                vscode.window.showInformationMessage('File saved successfully!');
            }
	        },
	        undefined,
	        context.subscriptions
        );
	});

	context.subscriptions.push(disposable, openFormCommand);
}

function getWebviewContent(webview: vscode.Webview, extensionPath: string): string {
	const mediaPath = path.join(extensionPath, 'media', 'webview');
	const indexPath = path.join(mediaPath, 'index.html');
	
	let html = fs.readFileSync(indexPath, 'utf8');

	// Replace relative paths with webview URIs
	html = html.replace(
		/(href|src)="\/assets\//g,
		(_match: string, attr: string) => {
			const assetsUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'assets')));
			return `${attr}="${assetsUri}/`;
		}
	);

	html = html.replace(
		/(href|src)="\.\//g,
		(_match: string, attr: string) => {
			const baseUri = webview.asWebviewUri(vscode.Uri.file(mediaPath));
			return `${attr}="${baseUri}/`;
		}
	);

	return html;
}

async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await axios.post('http://127.0.0.1:8000/api/users/v1/user_info/', {
      token
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

async function getAuth(currentPanel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
  const token = await context.secrets.get('authToken');
  const user = context.globalState.get('user');
  
  if (token && user) {
    // check token in the backend
    const isValid = await validateToken(token);
    
    if (isValid) {
      currentPanel?.webview.postMessage({
        command: 'authData',
        token: token,
        user: user
      });
    } else {
      // token not valid
      await context.secrets.delete('authToken');
      await context.secrets.delete('user');
      currentPanel?.webview.postMessage({
        command: 'authData',
        token: null,
        user: null
      });
    }
  } else {
    currentPanel?.webview.postMessage({
      command: 'authData',
      token: null,
      user: null
    });
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
