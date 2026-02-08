// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

// This method is called when your extension is deactivated
export function deactivate() {}
