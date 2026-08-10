import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_CHROME_PATH = "/usr/bin/google-chrome";
export const DEFAULT_VIEWPORT = Object.freeze({
  width: 1400,
  height: 1600,
  deviceScaleFactor: 1
});

export function readPosts(path){
  const data = JSON.parse(readFileSync(resolve(/* turbopackIgnore: true */ path), "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;

  if(!Array.isArray(posts)){
    throw new Error("Expected a JSON array or an object with a posts array.");
  }

  return posts;
}

export function outputPathFor(post, explicitOutput){
  if(explicitOutput) return resolve(/* turbopackIgnore: true */ explicitOutput);
  return resolve(/* turbopackIgnore: true */ post.imagePath || `generated/${post.id}.png`);
}

function mimeTypeFor(path){
  const ext = extname(path).toLowerCase();

  if(ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if(ext === ".webp") return "image/webp";
  if(ext === ".svg") return "image/svg+xml";
  return "image/png";
}

export function localImageToDataUrl(path){
  if(!path || /^https?:\/\//i.test(path) || path.startsWith("data:")) return path;

  const absolutePath = resolve(/* turbopackIgnore: true */ path);

  if(!existsSync(absolutePath)) return path;

  const encoded = readFileSync(absolutePath).toString("base64");
  return `data:${mimeTypeFor(path)};base64,${encoded}`;
}

export function postWithEmbeddedLocalImages(post){
  return {
    ...post,
    logoPath: localImageToDataUrl(post.logoPath),
    photoPath: localImageToDataUrl(post.photoPath)
  };
}

export function writePng(path, png){
  const outputPath = resolve(/* turbopackIgnore: true */ path);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, png);
  return outputPath;
}

export function writePngAtomically(path, png){
  const outputPath = resolve(/* turbopackIgnore: true */ path);
  const outputDirectory = dirname(outputPath);
  const temporaryPath = resolve(
    outputDirectory,
    `.${basename(outputPath)}.${randomUUID()}.tmp`
  );

  mkdirSync(outputDirectory, { recursive: true });

  try{
    writeFileSync(temporaryPath, png, { flag: "wx" });
    renameSync(temporaryPath, outputPath);
  } catch(error){
    try{
      unlinkSync(temporaryPath);
    } catch(cleanupError){
      if(cleanupError?.code !== "ENOENT"){
        error.cleanupError = cleanupError;
      }
    }
    throw error;
  }

  return outputPath;
}

async function launchDefaultBrowser(options){
  const { chromium } = await import("playwright-core");
  const configuredPath = options.executablePath || process.env.PLAYWRIGHT_CHROME_PATH;
  const executablePath = configuredPath || (
    existsSync(DEFAULT_CHROME_PATH) ? DEFAULT_CHROME_PATH : undefined
  );

  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: true,
    args: [
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--disable-gpu",
      "--no-sandbox"
    ]
  });
}

export async function createStaticImageRenderSession(options = {}){
  const launchBrowser = options.launchBrowser || launchDefaultBrowser;
  const browser = await launchBrowser(options);

  try{
    const page = await browser.newPage({
      viewport: options.viewport || DEFAULT_VIEWPORT
    });
    const htmlPath = resolve(/* turbopackIgnore: true */ options.htmlPath || "instagram.html");

    if(options.timeoutMs) page.setDefaultTimeout(options.timeoutMs);
    await page.goto(pathToFileURL(htmlPath).href);
    await page.waitForFunction(() => typeof window.renderPostForExport === "function");

    return {
      async render(post){
        const dataUrl = await page.evaluate(
          inputPost => window.renderPostForExport(inputPost),
          postWithEmbeddedLocalImages(post)
        );

        if(typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/png;base64,")){
          throw new Error("Static renderer returned an invalid PNG data URL.");
        }

        return Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64");
      },
      async close(){
        await browser.close();
      }
    };
  } catch(error){
    await browser.close();
    throw error;
  }
}
