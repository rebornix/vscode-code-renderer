import { render } from './render';
import errorOverlay from 'vscode-notebook-error-overlay';
import type { ActivationFunction } from 'vscode-notebook-renderer';
import { Tokenizer } from './tokenizer';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import style from 'monaco-editor/min/vs/editor/editor.main.css';

// Fix the public path so that any async import()'s work as expected.
// eslint-disable-next-line @typescript-eslint/naming-convention
declare const __webpack_relative_entrypoint_to_root__: string;
declare const scriptUrl: string;

__webpack_public_path__ = new URL(scriptUrl.replace(/[^/]+$/, '') + __webpack_relative_entrypoint_to_root__).toString();

// ----------------------------------------------------------------------------
// This is the entrypoint to the notebook renderer's webview client-side code.
// This contains some boilerplate that calls the `render()` function when new
// output is available. You probably don't need to change this code; put your
// rendering logic inside of the `render()` function.
// ----------------------------------------------------------------------------

export const activate: ActivationFunction = context => {
    let _initializeResolve: () => void;
    const initializePromise = new Promise<void>(resolve => {
        _initializeResolve = resolve;
    });

    const _languagePromises = new Map<string, Promise<void>>();
    const _pendingLanguageRequest: Map<string, () => void> = new Map<string, () => void>();
    async function loadLanguage(languageId: string) {
        console.log('load language', languageId);
        if (Tokenizer.hasLanguage(languageId)) {
            return;
        }

        if (_languagePromises.has(languageId)) {
            return _languagePromises.get(languageId);
        }

        const p = new Promise<void>(resolve => {
            _pendingLanguageRequest.set(languageId, resolve);
            context.postMessage!({
                type: 2,
                data: languageId
            });
        });
        _languagePromises.set(languageId, p);
        return p;
    }

    let themeData: any;
    let _loadThemeResolve: () => void;
    const loadThemePromise = new Promise<void>(resolve => {
        _loadThemeResolve = resolve;
    });
    const themeName = document.body.getAttribute('data-vscode-theme-name')!;
    const sanitizedThemeName = `notebook-${themeName.replace(/[^a-zA-Z0-9]/g, '-')}`;

    if (context.postMessage && context.onDidReceiveMessage) {
        context.onDidReceiveMessage(e => {
            switch (e.type) {
                case 1:
                    {
                        const arrayBuffer = new ArrayBuffer(e.data.data.length);
                        const uint8Array = new Uint8Array(arrayBuffer);
                        for (let i = 0; i < e.data.data.length; ++i) {
                            uint8Array[i] = e.data.data[i];
                        }
                        Tokenizer.loadOnigasm(arrayBuffer);
                        _initializeResolve();
                    }
                    break;
                case 2:
                    {
                        const data = e.data;
                        const languageId = data.languageId;
                        Tokenizer.loadLanguage(
                            data.languageId,
                            data.extensions,
                            data.scopeName,
                            data.languageConfiguration,
                            data.languageJSON    
                        );
                        console.log(languageId, ' language loaded');

                        if (_pendingLanguageRequest.has(languageId)) {
                            const resolve = _pendingLanguageRequest.get(languageId)!;
                            resolve();
                            _pendingLanguageRequest.delete(languageId);
                        }
                    }
                    break;
                case 3:
                    {
                        themeData = e.data;
                        monaco.editor.defineTheme(sanitizedThemeName, themeData);
                        console.log(themeData, ' theme loaded');
                        _loadThemeResolve();
                    }
                default:
                    break;
            }
            
        });

        context.postMessage({
            type: 1
        });

        context.postMessage({
            type: 3,
            data: themeName
        });
    }

        // Format the JSON and insert it as <pre><code>{ ... }</code></pre>
    // Replace this with your custom code!
    let styleTag = document.createElement('style');
    styleTag.innerHTML = style.toString();
    document.body.appendChild(styleTag);
    styleTag.classList.add('renderer-monaco-colors');

    return {
        renderOutputItem(outputItem, element) {
            const node = document.createElement('div');
            element.appendChild(node);
            const language = outputItem.mime.substring(7);
            render({ container: node, mime: outputItem.mime, value: outputItem.text(), context }, sanitizedThemeName, initializePromise.then(async () => {
                if (!themeData) {
                    await loadThemePromise;
                }
                await loadLanguage(language);
            }));
        },
        disposeOutputItem(outputId) {
            // Do any teardown here. outputId is the cell output being deleted, or
            // undefined if we're clearing all outputs.
        }
    };
};
