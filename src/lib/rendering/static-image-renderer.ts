import { existsSync, realpathSync } from "node:fs";
import { extname, isAbsolute, normalize, relative, resolve } from "node:path";

import type { LegacyStaticPost } from "./legacy-post-adapter";

export type StaticImageRenderErrorCode =
  | "browser_unavailable"
  | "asset_missing"
  | "render_timeout"
  | "render_failed"
  | "write_failed";

export class StaticImageRenderError extends Error {
  constructor(
    readonly code: StaticImageRenderErrorCode,
    message: string,
    options?: ErrorOptions
  ){
    super(message, options);
    this.name = "StaticImageRenderError";
  }
}

type RenderSession = {
  render(post: LegacyStaticPost): Promise<Buffer>;
  close(): Promise<void>;
};

type RendererModule = {
  createStaticImageRenderSession(options: {
    executablePath?: string;
    htmlPath: string;
    timeoutMs: number;
  }): Promise<RenderSession>;
  writePngAtomically(path: string, png: Buffer): string;
};

export type StaticImageRendererOptions = {
  repositoryRoot: string;
  mediaRoot: string;
  allowedAssetPaths: readonly string[];
  executablePath?: string;
  timeoutMs?: number;
  loadRendererModule?: () => Promise<RendererModule>;
};

export type StaticImageRenderRequest = {
  post: LegacyStaticPost;
  relativeOutputPath: string;
};

export type StaticImageRenderResult = {
  relativePath: string;
};

const DEFAULT_RENDER_TIMEOUT_MS = 30_000;

async function loadDefaultRendererModule(): Promise<RendererModule> {
  // This compatibility module remains plain ESM so the legacy Node CLI can use
  // exactly the same browser operation as the TypeScript application.
  // @ts-expect-error The legacy ESM module intentionally has no generated declarations.
  return import("../../../scripts/lib/static-image-renderer.mjs");
}

function isInside(parent: string, candidate: string): boolean {
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === "" || (
    !pathFromParent.startsWith("..") && !isAbsolute(pathFromParent)
  );
}

function safeRelativePath(
  path: string,
  label: string,
  code: "asset_missing" | "write_failed"
): string {
  const trimmed = path.trim();
  const normalized = normalize(trimmed);

  if(
    !trimmed ||
    isAbsolute(trimmed) ||
    trimmed.includes("\\") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    normalized === ".." ||
    normalized.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ){
    throw new StaticImageRenderError(code, `${label} is not an allowed local path.`);
  }

  return normalized;
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (
    error.name === "TimeoutError" || /timed out|timeout/i.test(error.message)
  );
}

export class StaticImageRenderer {
  private readonly repositoryRoot: string;
  private readonly mediaRoot: string;
  private readonly allowedAssetPaths: ReadonlySet<string>;
  private readonly executablePath?: string;
  private readonly timeoutMs: number;
  private readonly loadRendererModule: () => Promise<RendererModule>;
  private session: RenderSession | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: StaticImageRendererOptions){
    this.repositoryRoot = resolve(options.repositoryRoot);
    this.mediaRoot = resolve(options.mediaRoot);
    this.allowedAssetPaths = new Set(options.allowedAssetPaths);
    this.executablePath = options.executablePath;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
    this.loadRendererModule = options.loadRendererModule ?? loadDefaultRendererModule;
  }

  render(request: StaticImageRenderRequest): Promise<StaticImageRenderResult> {
    const operation = this.queue.then(() => this.renderNow(request));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async close(): Promise<void> {
    await this.queue;
    const session = this.session;
    this.session = null;
    if(session) await session.close();
  }

  private resolveAsset(path: string, label: string, optional = false): string {
    if(optional && path === "") return "";

    const relativePath = safeRelativePath(path, label, "asset_missing");
    if(!this.allowedAssetPaths.has(relativePath)){
      throw new StaticImageRenderError("asset_missing", `${label} is not in the brand asset allow-list.`);
    }

    const absolutePath = resolve(this.repositoryRoot, relativePath);
    if(!isInside(this.repositoryRoot, absolutePath) || !existsSync(absolutePath)){
      throw new StaticImageRenderError("asset_missing", `${label} is unavailable.`);
    }

    const realRepositoryRoot = realpathSync(this.repositoryRoot);
    const realAssetPath = realpathSync(absolutePath);
    if(!isInside(realRepositoryRoot, realAssetPath)){
      throw new StaticImageRenderError("asset_missing", `${label} resolves outside the repository.`);
    }

    return realAssetPath;
  }

  private resolveOutputPath(path: string): string {
    const relativePath = safeRelativePath(path, "Generated image path", "write_failed");
    const pathParts = relativePath.split("/");
    if(
      extname(relativePath).toLowerCase() !== ".png" ||
      pathParts.length !== 3 ||
      pathParts[0] !== "campaigns" ||
      !/^[a-zA-Z0-9_-]+$/.test(pathParts[1]) ||
      !/^[a-zA-Z0-9_-]+\.png$/.test(pathParts[2])
    ){
      throw new StaticImageRenderError(
        "write_failed",
        "Generated image path must be campaigns/<campaign-id>/<post-id>.png."
      );
    }

    const absolutePath = resolve(this.mediaRoot, relativePath);
    if(!isInside(this.mediaRoot, absolutePath)){
      throw new StaticImageRenderError("write_failed", "Generated image path escapes the media root.");
    }

    return absolutePath;
  }

  private async getSession(module: RendererModule): Promise<RenderSession> {
    if(this.session) return this.session;

    try{
      this.session = await module.createStaticImageRenderSession({
        executablePath: this.executablePath,
        htmlPath: resolve(this.repositoryRoot, "instagram.html"),
        timeoutMs: this.timeoutMs
      });
      return this.session;
    } catch(cause){
      throw new StaticImageRenderError(
        "browser_unavailable",
        "The preview browser is unavailable. Check the configured Chrome installation.",
        { cause }
      );
    }
  }

  private async renderNow(
    request: StaticImageRenderRequest
  ): Promise<StaticImageRenderResult> {
    const logoPath = this.resolveAsset(request.post.logoPath, "Brand logo");
    const photoPath = this.resolveAsset(request.post.photoPath, "Post photo", true);
    const outputPath = this.resolveOutputPath(request.relativeOutputPath);
    let rendererModule: RendererModule;

    try{
      rendererModule = await this.loadRendererModule();
    } catch(cause){
      throw new StaticImageRenderError(
        "browser_unavailable",
        "The preview browser is unavailable. Check the renderer installation.",
        { cause }
      );
    }

    const session = await this.getSession(rendererModule);
    let timer: ReturnType<typeof setTimeout> | undefined;

    try{
      const png = await Promise.race([
        session.render({ ...request.post, logoPath, photoPath }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            const timeout = new Error("Static image render timed out.");
            timeout.name = "TimeoutError";
            reject(timeout);
          }, this.timeoutMs);
        })
      ]);

      try{
        rendererModule.writePngAtomically(outputPath, png);
      } catch(cause){
        throw new StaticImageRenderError(
          "write_failed",
          "The replacement preview could not be saved; the last good preview was kept.",
          { cause }
        );
      }

      return { relativePath: request.relativeOutputPath };
    } catch(cause){
      if(cause instanceof StaticImageRenderError) throw cause;

      if(isTimeout(cause)){
        const staleSession = this.session;
        this.session = null;
        void staleSession?.close().catch(() => undefined);
        throw new StaticImageRenderError(
          "render_timeout",
          "The preview took too long to render. Try rendering it again.",
          { cause }
        );
      }

      throw new StaticImageRenderError(
        "render_failed",
        "The replacement preview could not be produced; the last good preview was kept.",
        { cause }
      );
    } finally {
      if(timer) clearTimeout(timer);
    }
  }
}
