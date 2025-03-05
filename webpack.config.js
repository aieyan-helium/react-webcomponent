import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export default {
    mode: "production",
    entry: ["./index.js"],
    output: {
        globalObject: `typeof self !== 'undefined' ? self : this`,
        path: path.resolve(__dirname, "dist"),
        filename: "index.js",
        library: {
            type: "module",
        },
        module: true,
    },
    experiments: {
        outputModule: true, // Enables ESM output
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                },
            },
            {
                test: /\.html$/,
                use: "html-loader",
            },
        ],
    },
};
