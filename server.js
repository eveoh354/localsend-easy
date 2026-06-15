import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { fileURLToPath } from "node:url";
import archiver from "archiver";
import express from "express";
import multer from "multer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "public");
const STORAGE_DIR = path.join(__dirname, "storage");
const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads");
const BUNDLE_DIR = path.join(STORAGE_DIR, "bundles");
const INDEX_FILE = path.join(STORAGE_DIR, "shares.json");
const DEFAULT_PORT = 53317;

for (const dir of [STORAGE_DIR, UPLOAD_DIR, BUNDLE_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const app = express();
const upload = multer({
  dest: UPLOAD_DIR,
  preservePath: true,
  limits: {
    files: 1000,
    fileSize: 1024 * 1024 * 1024 * 4
  }
});

const shares = new Map();
loadShares();

app.use(express.static(PUBLIC_DIR));

app.get("/api/info", (req, res) => {
  res.json({
    ip: getLocalIp(),
    port: req.socket.localPort,
    origin: `http://${getLocalIp()}:${req.socket.localPort}`
  });
});

app.get("/api/history", (req, res) => {
  const origin = `http://${getLocalIp()}:${req.socket.localPort}`;
  res.json(getRecentShares().map((share) => toClientShare(share, origin)));
});

app.post("/api/upload", upload.array("files", 1000), async (req, res, next) => {
  try {
    const files = req.files ?? [];
    if (!files.length) {
      res.status(400).json({ error: "请选择文件或文件夹" });
      return;
    }

    const rawNames = Array.isArray(req.body.paths) ? req.body.paths : [req.body.paths].filter(Boolean);
    const entries = files.map((file, index) => {
      const requestedPath = normalizeUploadPath(rawNames[index] || file.originalname || file.filename);
      return {
        diskPath: file.path,
        originalPath: requestedPath,
        size: file.size
      };
    });

    const isSinglePlainFile = entries.length === 1 && !entries[0].originalPath.includes("/");
    const firstPath = entries[0].originalPath;
    const shareName = isSinglePlainFile ? path.basename(firstPath) : getBundleName(entries);
    const hash = await createShareHash(entries);
    const slug = `${slugify(path.parse(shareName).name || "share")}-${hash}`;

    let share;
    if (isSinglePlainFile) {
      const targetPath = path.join(BUNDLE_DIR, `${slug}-${path.basename(firstPath)}`);
      await fs.promises.rename(entries[0].diskPath, targetPath);
      share = {
        kind: "file",
        name: path.basename(firstPath),
        size: entries[0].size,
        path: targetPath,
        mime: "application/octet-stream"
      };
    } else {
      const zipName = `${path.parse(shareName).name || "share"}.zip`;
      const zipPath = path.join(BUNDLE_DIR, `${slug}.zip`);
      await createZip(zipPath, entries);
      await Promise.all(entries.map((entry) => fs.promises.rm(entry.diskPath, { force: true })));
      const stat = await fs.promises.stat(zipPath);
      share = {
        kind: "zip",
        name: zipName,
        size: stat.size,
        path: zipPath,
        mime: "application/zip"
      };
    }

    const savedShare = await saveRecentShare(slug, share);

    const origin = `http://${getLocalIp()}:${req.socket.localPort}`;
    res.json(toClientShare({ slug, ...savedShare }, origin));
  } catch (error) {
    next(error);
  }
});

app.get("/:slug", (req, res, next) => {
  const share = shares.get(req.params.slug);
  if (!share) {
    res.status(404).send("文件不存在或服务已重启");
    return;
  }

  res.download(share.path, share.name, (error) => {
    if (error && !res.headersSent) {
      next(error);
    }
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "上传失败，请重试" });
});

const port = await findAvailablePort(DEFAULT_PORT);
app.listen(port, "0.0.0.0", () => {
  const ip = getLocalIp();
  console.log(`LocalSend Easy: http://${ip}:${port}`);
  console.log(`Local: http://localhost:${port}`);
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return "127.0.0.1";
}

function findAvailablePort(startPort) {
  return new Promise((resolve) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.unref();
      server.on("error", () => tryPort(port + 1));
      server.listen(port, "0.0.0.0", () => {
        server.close(() => resolve(port));
      });
    };
    tryPort(startPort);
  });
}

function normalizeUploadPath(input) {
  return String(input)
    .replaceAll("\\", "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
}

function getBundleName(entries) {
  const first = entries[0]?.originalPath || "share";
  const root = first.split("/")[0];
  return root && entries.every((entry) => entry.originalPath.startsWith(`${root}/`))
    ? root
    : "files";
}

function slugify(input) {
  const cleaned = input
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || "file";
}

async function createShareHash(entries) {
  const hash = crypto.createHash("sha256");
  const sortedEntries = [...entries].sort((a, b) => a.originalPath.localeCompare(b.originalPath));

  for (const entry of sortedEntries) {
    if (entries.length > 1) {
      hash.update(entry.originalPath);
      hash.update("\0");
    }
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(entry.diskPath);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("error", reject);
      stream.on("end", resolve);
    });
    hash.update("\0");
  }

  return hash.digest("hex").slice(0, 8);
}

function createZip(zipPath, entries) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    for (const entry of entries) {
      archive.file(entry.diskPath, { name: entry.originalPath || path.basename(entry.diskPath) });
    }

    archive.finalize();
  });
}

function loadShares() {
  try {
    const saved = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
    for (const share of saved) {
      if (share.slug && share.path && fs.existsSync(share.path)) {
        shares.set(share.slug, {
          kind: share.kind,
          name: share.name,
          size: share.size,
          path: share.path,
          mime: share.mime,
          createdAt: share.createdAt
        });
      }
    }
  } catch {
    // No saved history yet.
  }
}

function getRecentShares() {
  return [...shares.entries()]
    .map(([slug, share]) => ({ slug, ...share }))
    .filter((share) => share.createdAt)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);
}

async function saveRecentShare(slug, share) {
  const withTime = { ...share, createdAt: Date.now() };
  shares.set(slug, withTime);
  const recent = [{ slug, ...withTime }, ...getRecentShares().filter((item) => item.slug !== slug)].slice(0, 10);
  await fs.promises.writeFile(INDEX_FILE, JSON.stringify(recent, null, 2));
  return withTime;
}

function toClientShare(share, origin) {
  return {
    name: share.name,
    size: share.size,
    url: `${origin}/${share.slug}`,
    path: `/${share.slug}`,
    kind: share.kind,
    createdAt: share.createdAt
  };
}
