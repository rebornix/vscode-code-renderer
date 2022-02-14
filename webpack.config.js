const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const { DefinePlugin } = require('webpack');
const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const makeConfig = (argv, { entry, out, target, library = 'commonjs' }) => ({
    mode: argv.mode,
    devtool: argv.mode === 'production' ? false : 'inline-source-map',
    entry,
    target,
    output: {
        path: path.join(__dirname, path.dirname(out)),
        filename: path.basename(out),
        publicPath: '',
        libraryTarget: library,
        chunkFormat: library,
    },
    externals: {
        vscode: 'commonjs vscode',
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.css'],
        fallback: { "util": require.resolve("util/"), "path": false },
    },
    experiments: {
        outputModule: true,
    },
    module: {
        rules: [
            // Allow importing ts(x) files:
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                options: {
                    configFile: path.join(path.dirname(entry), 'tsconfig.json'),
                    // transpileOnly enables hot-module-replacement
                    transpileOnly: true,
                    compilerOptions: {
                        // Overwrite the noEmit from the client's tsconfig
                        noEmit: false,
                    },
                },
            },
            // Allow importing CSS modules:
            {
                test: /\.css$/,
                use:'css-loader'
            },
            {
				test: /\.ttf$/,
				use: ['file-loader']
			}
        ],
    },
    plugins: [
        new ForkTsCheckerWebpackPlugin({
            typescript: {
                configFile: path.join(path.dirname(entry), 'tsconfig.json'),
            },
        }),
        new DefinePlugin({
            // Path from the output filename to the output directory
            __webpack_relative_entrypoint_to_root__: JSON.stringify(
                path.posix.relative(path.posix.dirname(`/index.js`), '/'),
            ),
            scriptUrl: 'import.meta.url',
        }),
    ],
    infrastructureLogging: {
        level: "log", // enables logging required for problem matchers
    },
    optimization: {
		minimize: true,
		minimizer: [new TerserPlugin()]
	}
});

module.exports = (env, argv) => [
    makeConfig(argv, { entry: './src/client/index.ts', out: './out/client/index.js',  target: 'web', library: 'module' }),
    {
        target: 'node', // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
        entry: './src/extension/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
        output: { // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
            path: path.resolve(__dirname, 'out/extension/'),
            filename: 'extension.js',
            libraryTarget: "commonjs2"
        },
        devtool: argv.mode === 'production' ? false : 'source-map',
        externals: {
            vscode: "commonjs vscode" // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        },
        resolve: { // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
            extensions: ['.ts', '.js']
        },
        module: {
            rules: [{
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        compilerOptions: {
                            "module": "es6" // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
                        }
                    }
                }]
            }]
        }
    }
];
