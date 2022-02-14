// We've set up this sample using CSS modules, which lets you import class
// names into JavaScript: https://github.com/css-modules/css-modules
// You can configure or change this in the webpack.config.js file.
import type { RendererContext } from 'vscode-notebook-renderer';
import 'monaco-editor/esm/vs/editor/browser/controller/coreCommands.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

interface IRenderInfo {
    container: HTMLElement;
    mime: string;
    value: any;
    context: RendererContext<unknown>;
}

// This function is called to render your contents.
export function render(info: { container: HTMLElement, mime: string, value: string, context: RendererContext<unknown> }, themeName: string, texmateInit: Promise<any>) {
    let monacoEditorOverride = document.createElement('style');
    monacoEditorOverride.innerHTML = `
    .monaco-editor, .monaco-editor-background,
    .monaco-editor, .margin,
    .monaco-editor .inputarea.ime-input {
        background-color: var(--vscode-editorWidget-background) !important;
    }
    `;
    info.container.appendChild(monacoEditorOverride);

    const editorContainer = document.createElement('div');
    editorContainer.style.backgroundColor = `var()`;
    editorContainer.className = 'editor-container';
    editorContainer.style.width = '100%';

    info.container.appendChild(editorContainer);
    const language = info.mime.substring(7);

    const model = monaco.editor.createModel(info.value, language);
    const editor = monaco.editor.create(editorContainer, {readOnly: true,
        dimension: { height: 0, width: 0 },
        padding: { top: 5 },
		wordWrap: 'on',
		overviewRulerLanes: 0,
		glyphMargin: false,
		selectOnLineNumbers: false,
		hideCursorInOverviewRuler: true,
		selectionHighlight: false,
		lineDecorationsWidth: 0,
		overviewRulerBorder: false,
		scrollBeyondLastLine: false,
		renderLineHighlight: 'none',
		minimap: {
			enabled: false
		},
		lineNumbers: 'off',
		scrollbar: {
			alwaysConsumeMouseWheel: false
		},
		automaticLayout: true,
        theme: document.body.classList.contains('vscode-light') ? 'vs' : 'vs-dark'
    });
    editor.onDidContentSizeChange(e => {
        const editorHeight = Math.min(16 *  18, e.contentHeight);
        const width = editorContainer.getBoundingClientRect().width;
        editor.layout({ height: editorHeight, width: width });
        editorContainer.style.height = `${editorHeight + 8}px`;
    });
    editor.setModel(model);
    const width = editorContainer.getBoundingClientRect().width;
    const height =  Math.min(model.getLineCount(), 16) * 18;
    editor.layout({ height, width });
    editorContainer.style.height = `${height + 8}px`;

    texmateInit.then(() => {
        console.log(themeName);
        editor.updateOptions({
            theme: themeName
        });
        editor.layout();
    });
}

if (module.hot) {
    module.hot.addDisposeHandler(() => {
        // In development, this will be called before the renderer is reloaded. You
        // can use this to clean up or stash any state.
    });
}
