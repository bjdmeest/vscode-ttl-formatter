// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DOCUMENT_FILTER } from './document_filter';
import { Formatter, TTLDocumentRangeFormattingEditProvider } from './formatter';


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "ttlformatter" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let fixCommand = vscode.commands.registerCommand('ttlformatter.fix', () => {
		let formatter: Formatter = new Formatter();
		if (vscode.window.activeTextEditor) {
			formatter.formatDocument(vscode.window.activeTextEditor.document);
		}
	});

	// Register ourselves as a document formatter, so we can do things like FormatOnSave.
	let formattingProvider =
		vscode.languages.registerDocumentRangeFormattingEditProvider(DOCUMENT_FILTER, new TTLDocumentRangeFormattingEditProvider());


	context.subscriptions.push(fixCommand);
	context.subscriptions.push(formattingProvider);
}

// this method is called when your extension is deactivated
export function deactivate() { }
