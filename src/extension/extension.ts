// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ThemeFinder } from './themeFinder';

// This method is called when your extension is activated
// your extension is activated the very first time the command is executed
const enum MessageType {
    LoadOnig = 1,
    LoadLanguage = 2,
    LoadTheme = 3
}

interface IRequestMessage {
    type: MessageType;
    data: any;
}

export function activate(context: vscode.ExtensionContext) {
    const themeFinder = new ThemeFinder();
    const port = vscode.notebooks.createRendererMessaging('vscode-code-renderer');
    context.subscriptions.push(port.onDidReceiveMessage((e: { editor: any, message: IRequestMessage }) => {
        switch (e.message.type) {
            case MessageType.LoadOnig:
                loadOnig(port, e.editor);
                break;
            case MessageType.LoadLanguage:
                loadLanguage(themeFinder, port, e.message.data);
                break;
            case MessageType.LoadTheme:
                loadTheme(themeFinder, port, e.message.data);
                break;
            default:
                break;
        }
    }));
}

async function loadLanguage(themeFinder: ThemeFinder, port: vscode.NotebookRendererMessaging, languageId: string) {
    const ret = await themeFinder.requestTmLanguage(languageId);
    port.postMessage({
        type: MessageType.LoadLanguage,
        data: ret
    });
}

async function loadTheme(themeFinder: ThemeFinder, port: vscode.NotebookRendererMessaging, themeName: string) {
    const ret = await themeFinder.generateTheme(themeName);
    port.postMessage({
        type: MessageType.LoadTheme,
        data: ret
    });
}

async function loadOnig(port: vscode.NotebookRendererMessaging, editor: any) {
    let filePath = path.join(__dirname, '../../', 'node_modules', 'onigasm', 'lib', 'onigasm.wasm');
    if (fs.existsSync(filePath)) {
        const contents = await fs.promises.readFile(filePath);
        port.postMessage({
            type: MessageType.LoadOnig,
            data: contents
        }, editor);
    }
}

// This method is called when your extension is deactivated
export function deactivate() { }
