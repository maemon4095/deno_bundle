import { bundle as bundleScript, BundleOptions as BundleScriptOptions } from "https://deno.land/x/emit@0.38.2/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
import { assert } from "$std/assert/mod.ts";
import { basename, dirname, extname, join } from "$std/path/mod.ts";
import * as fs from "$std/fs/mod.ts";

export type BundleOptions = {
    documentPath: string,
    distDir: string,
    denoConfigPath?: string;
    embedScript?: boolean;
};

export async function bundle(options: BundleOptions) {
    const { distDir, documentPath } = options;
    await fs.emptyDir(distDir);
    const rawdoc = await Deno.readTextFile(documentPath);
    const document = new DOMParser().parseFromString(rawdoc, "text/html");
    assert(document !== null, "Failed to parse document file.");
    const documentDir = dirname(documentPath);
    const bundleScriptOptions = await getBundleScriptOptions(options);
    const scripts = document.getElementsByTagName("script");
    for (const script of scripts) {
        const src = script.getAttribute("src");
        if (!src) continue;
        if (options?.embedScript) {
            script.removeAttribute("src");
            const result = await bundleScript(join(documentDir, src), bundleScriptOptions);
            script.textContent = result.code;
        } else {
            const ext = extname(src);
            const newsrc = src.substring(0, src.length - ext.length) + ".js";
            script.setAttribute("src", newsrc);
            const result = await bundleScript(join(documentDir, src), bundleScriptOptions);
            await fs.emptyDir(join(distDir, dirname(newsrc)));
            await Deno.writeTextFile(join(distDir, newsrc), result.code);
        }
    }
    const result = document.documentElement?.outerHTML ?? "";
    await Deno.mkdir(distDir, { recursive: true });
    const distPath = join(distDir, basename(documentPath));
    await Deno.writeTextFile(distPath, result);
}

async function getBundleScriptOptions(options: undefined | BundleOptions): Promise<BundleScriptOptions> {
    const config: BundleScriptOptions = {
        "allowRemote": true,
        "minify": true,
        "type": "module",
        "compilerOptions": {
            "inlineSourceMap": true
        }
    };
    if (!options) return config;
    if (options.denoConfigPath) {
        const rawconfig = await Deno.readTextFile(options.denoConfigPath);
        const denoconfig = JSON.parse(rawconfig);
        config.compilerOptions = { ...config.compilerOptions, ...denoconfig["compilerOptions"] };
        config.importMap = options.denoConfigPath;
    }
    return config;
}