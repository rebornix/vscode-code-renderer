// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';

interface IThemeData {
    rootFile: string;
    isDark: boolean;
}

const MonacoColorRegEx = /^#?([0-9A-Fa-f]{6})([0-9A-Fa-f]{2})?$/;
const ThreeColorRegEx = /^#?([0-9A-Fa-f])([0-9A-Fa-f])([0-9A-Fa-f])$/;

export class ThemeFinder {

    private themeCache: { [key: string]: IThemeData | undefined } = {};
    private languageCache: { [key: string]: string | undefined } = {};

    //#region TM Language
    async requestTmLanguage(languageId: string) {
        const languageConfiguration = await this.findMatchingLanguageConfiguration(languageId) ?? {};
        const scopeName = `scope.${languageId}`;
        const languageJson = await this.findTmLanguage(languageId);
        const extensions: string[] = [];
        return {
            languageJSON: languageJson ?? '',
            languageConfiguration,
            extensions,
            scopeName,
            languageId
        };
    }

    private async findTmLanguage(language: string) {
        if (!this.themeCache.hasOwnProperty(language)) {
            try {
                this.languageCache[language] = await this.findMatchingLanguage(language);
            } catch (exc) {
                console.error(exc);
            }
        }
        return this.languageCache[language];
    }

    private async findMatchingLanguage(language: string): Promise<string | undefined> {
        const extensionsPath = this.getExtensionsPath();

        // Search through all of the files in this folder
        let results = await this.findMatchingLanguages(language, extensionsPath);


        return results;
    }

    private async searchLocal(pattern: string, rootPath: string) {
        return new Promise<string[]>((resolve, reject) => {
            glob(pattern, { cwd: rootPath }, (err, matches) => {
                if (err) {
                    reject();
                } else {
                    resolve(matches);
                }
            });
        });
    }

    private async findMatchingLanguages(language: string, rootPath: string): Promise<string | undefined> {
        for (let i = 0; i < vscode.extensions.all.length; i++) {
            const data = await this.findMatchingLanguageFromJson(vscode.extensions.all[i], language);
            if (data) {
                return data;
            }
        }
    }

    private async findMatchingLanguageFromJson(extension: vscode.Extension<any>, language: string): Promise<string | undefined> {
        // Read the contents of the json file
        // const text = (await fs.promises.readFile(extension.ex)).toString();
        const json = extension.packageJSON;

        // Should have a name entry and a contributes entry
        if (json.hasOwnProperty('name') && json.hasOwnProperty('contributes')) {
            // See if contributes has a grammars
            const contributes = json.contributes;
            if (contributes.hasOwnProperty('grammars')) {
                const grammars = contributes.grammars as any[];
                // Go through each theme, seeing if the label matches our theme name
                for (const t of grammars) {
                    if (t.hasOwnProperty('language') && t.language === language) {
                        // Path is relative to the package.json file.
                        const rootFile = t.hasOwnProperty('path')
                            // not correct actually, it should be relative to the package.json
                            ? path.join(extension.extensionPath, t.path.toString())
                            : '';
                        return fs.promises.readFile(rootFile).then((data) => {
                            return data.toString();
                        });
                    }
                }
            }
        }
    }

    private async findMatchingLanguageConfiguration(language: string) {
        try {
            const extensionsPath = this.getExtensionsPath();

            // See if the 'language-configuration.json' file exists
            if (fs.existsSync(path.join(extensionsPath, language, 'language-configuration.json'))) {
                const contents = await fs.promises.readFile(path.join(extensionsPath, 'language-configuration.json'));
                return contents.toString();
            }

            if (fs.existsSync(path.join(extensionsPath, language, `${language}-language-configuration.json`))) {
                const contents = await fs.promises.readFile(path.join(extensionsPath, `${language}-language-configuration.json`));
                return contents.toString();
            }

        } catch (_e) {
            return {};
        }
    }

    //#endregion

    //#region  Theme

    async generateTheme(theme: string) {
        const ret = await this.findTokenColors(theme);

        if (!ret) {
            return {
                base: 'vs-dark',
                inherit: false,
                rules: [],
                colors: {}
            };
        }
        
        const result: {
            base: string,
            inherit: boolean,
            rules: any[],
            colors: any
        } = {
            base: ret.type === 'dark' ? 'vs-dark' : 'vs',
            inherit: false,
            rules: [],
            colors: ret.colors
        };

        const tokenSet = new Set<string>();
        ret.tokenColors.forEach((t: any) => {
            const scopes = this.getScopes(t);
            const settings = t && t.settings ? t.settings : undefined;
            if (scopes && settings) {
                scopes.forEach((s: any) => {
                    const token = s ? s.toString() : '';
                    if (!tokenSet.has(token)) {
                        tokenSet.add(token);

                        if (settings.foreground) {
                            // Make sure matches the monaco requirements of having 6 values
                            if (!MonacoColorRegEx.test(settings.foreground)) {
                                const match = ThreeColorRegEx.exec(settings.foreground);
                                if (match && match.length > 3) {
                                    settings.foreground = `#${match[1]}${match[1]}${match[2]}${match[2]}${match[3]}${match[3]}`;
                                } else {
                                    settings.foreground = undefined;
                                }
                            }
                        }

                        if (settings.foreground) {
                            result.rules.push({
                                token,
                                foreground: settings.foreground,
                                background: settings.background,
                                fontStyle: settings.fontStyle
                            });
                        } else {
                            result.rules.push({
                                token,
                                background: settings.background,
                                fontStyle: settings.fontStyle
                            });
                        }

                        // Special case some items. punctuation.definition.comment doesn't seem to
                        // be listed anywhere. Add it manually when we find a 'comment'
                        // tslint:disable-next-line: possible-timing-attack
                        if (token === 'comment') {
                            result.rules.push({
                                token: 'punctuation.definition.comment',
                                foreground: settings.foreground,
                                background: settings.background,
                                fontStyle: settings.fontStyle
                            });
                        }

                        // Same for string
                        // tslint:disable-next-line: possible-timing-attack
                        if (token === 'string') {
                            result.rules.push({
                                token: 'punctuation.definition.string',
                                foreground: settings.foreground,
                                background: settings.background,
                                fontStyle: settings.fontStyle
                            });
                        }
                    }
                });
            }
        });

        result.rules = result.rules.sort(
            (a: any, b: any) => {
                return a.token.localeCompare(b.token);
            }
        );

        return result;
    }

    private getScopes(entry: any) {
        if (entry && entry.scope) {
            return Array.isArray(entry.scope) ? (entry.scope) : entry.scope.toString().split(',');
        }
        return [];
    }

    async findTokenColors(theme: string): Promise<{
        type: string,
        colors: any
        tokenColors: any[]
    } | undefined> {
        console.log(`load theme ${theme}`);
        const themeRoot = await this.findThemeRootJson(theme);

        if (themeRoot) {
            const contents = await fs.promises.readFile(themeRoot);
            const json = JSON.parse(contents.toString());

            const contributes = json.contributes;

            // If no contributes section, see if we have a tokenColors section. This means
            // this is a direct token colors file
            if (!contributes) {
                const tokenColors = json.tokenColors;
                if (tokenColors) {
                    return await this.readColors(themeRoot);
                }
            }

            // This should have a themes section
            const themes = contributes.themes;

            // One of these (it's an array), should have our matching theme entry
            const index = themes.findIndex((e: any) => {
                return e !== null && (e.id === theme || e.name === theme);
            });

            const found = index >= 0 ? (themes[index] as any) : null;
            if (found !== null) {
                // Then the path entry should contain a relative path to the json file with
                // the tokens in it
                const themeFile = path.join(path.dirname(themeRoot), found.path);
                console.log(`Reading colors from ${themeFile}`);
                return await this.readColors(themeFile);
            }
        }
    }

    private async readColors(themeFile: string): Promise<{
        type: string,
        colors: any
        tokenColors: any[]
    }> {
        try {
            const tokenContent = await fs.promises.readFile(themeFile);
            const theme = JSON.parse(tokenContent.toString());
            const type = theme.type;
            const colors = theme.colors;
            let tokenColors = [];

            if (typeof theme.tokenColors === 'string') {
                const style = await fs.promises.readFile(theme.tokenColors);
                tokenColors = JSON.parse(style.toString());
            } else {
                tokenColors = theme.tokenColors;
            }

            if (tokenColors && tokenColors.length > 0) {
                // This theme may include others. If so we need to combine the two together
                const include = theme ? theme.include : undefined;
                if (include) {
                    const includePath = path.join(path.dirname(themeFile), include.toString());
                    const includedColors = await this.readColors(includePath);
                    return {
                        type,
                        colors,
                        tokenColors: this.mergeColors(tokenColors, includedColors)
                    };
                }

                // Theme is a root, don't need to include others
                return {
                    type,
                    colors,
                    tokenColors
                };
            }

            // Might also have a 'settings' object that equates to token colors
            const settings = theme.settings;
            if (settings && settings.length > 0) {
                return settings;
            }

            return {
                type,
                colors,
                tokenColors: []
            };
        } catch (e) {
            console.error('Notebook Code Renderer: Error reading custom theme', e);
            return {
                type: 'vs',
                colors: {},
                tokenColors: []
            };
        }
    };

    private mergeColors(colors1: any, colors2: any) {
        return [...colors1, ...colors2];
    };

    public async findThemeRootJson(themeName: string): Promise<string | undefined> {
        // find our data
        const themeData = await this.findThemeData(themeName);

        // Use that data if it worked
        if (themeData) {
            return themeData.rootFile;
        }
    }

    private async findThemeData(themeName: string): Promise<IThemeData | undefined> {
        // See if already found it or not
        if (!this.themeCache.hasOwnProperty(themeName)) {
            try {
                this.themeCache[themeName] = await this.findMatchingTheme(themeName);
            } catch (exc) {
                console.error(exc);
            }
        }
        return this.themeCache[themeName];
    }

    private async findMatchingTheme(themeName: string): Promise<IThemeData | undefined> {
        // Look through all extensions to find the theme. This will search
        // the default extensions folder and our installed extensions.
        const extensions = vscode.extensions.all;
        for (const e of extensions) {
            const result = await this.findMatchingThemeFromJson(path.join(e.extensionPath, 'package.json'), themeName);
            if (result) {
                return result;
            }
        }

        const extensionsPath = this.getExtensionsPath();
        const other = await this.findMatchingThemes(extensionsPath, themeName);
        if (other) {
            return other;
        }
    }

    private async findMatchingThemes(rootPath: string, themeName: string): Promise<IThemeData | undefined> {
        // Search through all package.json files in the directory and below, looking
        // for the themeName in them.
        const foundPackages = await this.searchLocal('**/package.json', rootPath);
        if (foundPackages && foundPackages.length > 0) {
            // For each one, open it up and look for the theme name.
            for (const f of foundPackages) {
                const fpath = path.join(rootPath, f);
                const data = await this.findMatchingThemeFromJson(fpath, themeName);
                if (data) {
                    return data;
                }
            }
        }
    }

    private async findMatchingThemeFromJson(packageJson: string, themeName: string): Promise<IThemeData | undefined> {
        // Read the contents of the json file
        const text = (await fs.promises.readFile(packageJson)).toString();
        const json = JSON.parse(text);

        // Should have a name entry and a contributes entry
        if (json.hasOwnProperty('name') && json.hasOwnProperty('contributes')) {
            // See if contributes has a theme
            const contributes = json.contributes;
            if (contributes.hasOwnProperty('themes')) {
                const themes = contributes.themes as any[];
                // Go through each theme, seeing if the label matches our theme name
                for (const t of themes) {
                    if (
                        (t.hasOwnProperty('label') && t.label === themeName) ||
                        (t.hasOwnProperty('id') && t.id === themeName)
                    ) {
                        const isDark = t.hasOwnProperty('uiTheme') && t.uiTheme === 'vs-dark';
                        // Path is relative to the package.json file.
                        const rootFile = t.hasOwnProperty('path')
                            ? path.join(path.dirname(packageJson), t.path.toString())
                            : '';

                        return { isDark, rootFile };
                    }
                }
            }
        }
    }

    //#endregion

    private getExtensionsPath(): string {
        const currentExe = process.execPath;
        let currentPath = path.dirname(currentExe);

        // Should be somewhere under currentPath/resources/app/extensions inside of a json file
        let extensionsPath = path.join(currentPath, 'resources', 'app', 'extensions');
        if (!(fs.existsSync(extensionsPath))) {
            extensionsPath = path.join(currentPath, '../', 'resources', 'app', 'extensions');
        }

        return extensionsPath;
    }
}