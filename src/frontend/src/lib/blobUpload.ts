/**
 * Blob upload helper that correctly handles both synchronous (v3) and
 * asynchronous (v2) IC responses when obtaining a storage certificate.
 *
 * On production IC replicas, /api/v3 returns a 202 Accepted (v2 async
 * response) instead of an inline certificate. This module polls readState
 * until the IC returns certificate bytes and passes them directly to the
 * storage gateway without local certificate verification (which requires
 * fetchRootKey and only works on localhost).
 */

import {
  HttpAgent,
  type Identity,
  isV3ResponseBody,
} from "@icp-sdk/core/agent";
import { IDL } from "@icp-sdk/core/candid";
import { loadConfig } from "../config";

// ─── Types ──────────────────────────────────────────────────────────────────

const GATEWAY_VERSION = "v1";
const CHUNK_SIZE = 1024 * 1024; // 1 MB
const HASH_ALGORITHM = "SHA-256";
const SHA256_PREFIX = "sha256:";
const DOMAIN_SEPARATOR_FOR_CHUNKS = new TextEncoder().encode("icfs-chunk/");
const DOMAIN_SEPARATOR_FOR_METADATA = new TextEncoder().encode(
  "icfs-metadata/",
);
const DOMAIN_SEPARATOR_FOR_NODES = new TextEncoder().encode("ynode/");

// ─── Hashing utilities ───────────────────────────────────────────────────────

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest(HASH_ALGORITHM, data as BufferSource),
  );
}

async function hashWithSeparator(
  sep: Uint8Array,
  data: Uint8Array,
): Promise<Uint8Array> {
  const combined = new Uint8Array(sep.length + data.length);
  combined.set(sep);
  combined.set(data, sep.length);
  return sha256(combined);
}

async function hashChunk(data: Uint8Array): Promise<Uint8Array> {
  return hashWithSeparator(DOMAIN_SEPARATOR_FOR_CHUNKS, data);
}

async function hashHeaders(
  headers: Record<string, string>,
): Promise<Uint8Array> {
  const lines = Object.entries(headers)
    .map(([k, v]) => `${k.trim()}: ${v.trim()}\n`)
    .sort();
  return hashWithSeparator(
    DOMAIN_SEPARATOR_FOR_METADATA,
    new TextEncoder().encode(lines.join("")),
  );
}

async function hashNodes(
  left: Uint8Array | null,
  right: Uint8Array | null,
): Promise<Uint8Array> {
  const leftBytes = left ?? new TextEncoder().encode("UNBALANCED");
  const rightBytes = right ?? new TextEncoder().encode("UNBALANCED");
  const combined = new Uint8Array(
    DOMAIN_SEPARATOR_FOR_NODES.length + leftBytes.length + rightBytes.length,
  );
  combined.set(DOMAIN_SEPARATOR_FOR_NODES);
  combined.set(leftBytes, DOMAIN_SEPARATOR_FOR_NODES.length);
  combined.set(
    rightBytes,
    DOMAIN_SEPARATOR_FOR_NODES.length + leftBytes.length,
  );
  return sha256(combined);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toShaString(bytes: Uint8Array): string {
  return `${SHA256_PREFIX}${toHex(bytes)}`;
}

// ─── Merkle tree builder ─────────────────────────────────────────────────────

interface TreeNode {
  hash: Uint8Array;
  left: TreeNode | null;
  right: TreeNode | null;
}

interface BlobHashTreeJSON {
  tree_type: "DSBMTWH";
  chunk_hashes: string[];
  tree: { hash: string; left: unknown; right: unknown };
  headers: string[];
}

function nodeToJSON(node: TreeNode): {
  hash: string;
  left: unknown;
  right: unknown;
} {
  return {
    hash: toShaString(node.hash),
    left: node.left ? nodeToJSON(node.left) : null,
    right: node.right ? nodeToJSON(node.right) : null,
  };
}

async function buildBlobHashTree(
  chunkHashes: Uint8Array[],
  headers: Record<string, string> = {},
): Promise<{
  root: TreeNode;
  tree_type: "DSBMTWH";
  headers: string[];
  chunk_hashes: Uint8Array[];
}> {
  let hashes = chunkHashes;
  if (hashes.length === 0) {
    const hex =
      "8b8e620f084e48da0be2287fd12c5aaa4dbe14b468fd2e360f48d741fe7628a0";
    hashes = [new TextEncoder().encode(hex)];
  }

  let level: TreeNode[] = hashes.map((h) => ({
    hash: h,
    left: null,
    right: null,
  }));
  while (level.length > 1) {
    const next: TreeNode[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || null;
      const parentHash = await hashNodes(left.hash, right ? right.hash : null);
      next.push({ hash: parentHash, left, right: right || null });
    }
    level = next;
  }

  let chunksRoot = level[0];

  const headerKeys = Object.keys(headers);
  if (headerKeys.length > 0) {
    const metaHash = await hashHeaders(headers);
    const metaNode: TreeNode = { hash: metaHash, left: null, right: null };
    const combinedHash = await hashNodes(chunksRoot.hash, metaNode.hash);
    chunksRoot = { hash: combinedHash, left: chunksRoot, right: metaNode };
  }

  const headerLines = Object.entries(headers)
    .map(([k, v]) => `${k.trim()}: ${v.trim()}`)
    .sort();

  return {
    root: chunksRoot,
    tree_type: "DSBMTWH",
    headers: headerLines,
    chunk_hashes: hashes,
  };
}

function buildTreeJSON(
  root: TreeNode,
  tree_type: "DSBMTWH",
  headers: string[],
  chunk_hashes: Uint8Array[],
): BlobHashTreeJSON {
  return {
    tree_type,
    chunk_hashes: chunk_hashes.map(toShaString),
    tree: nodeToJSON(root) as BlobHashTreeJSON["tree"],
    headers,
  };
}

// ─── Certificate fetch (with polling fallback) ───────────────────────────────

/**
 * Poll readState until the IC returns certificate bytes.
 *
 * On production IC we cannot verify the certificate locally (that requires
 * fetchRootKey which only works on localhost), so we skip verification and
 * return the raw CBOR bytes as soon as readState provides them. The storage
 * gateway does its own verification server-side.
 */
// biome-ignore lint/suspicious/noExplicitAny: private IC agent API
async function pollForCertificate(
  agent: any,
  canisterId: string,
  requestId: Uint8Array,
  maxAttempts = 30,
  delayMs = 1500,
): Promise<Uint8Array> {
  const requestStatusKey = new TextEncoder().encode("request_status");
  const path = [requestStatusKey, requestId];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    let state: { certificate?: unknown } | null = null;
    try {
      state = await agent.readState(canisterId, { paths: [path] });
    } catch {
      // Transient network error — retry
      continue;
    }

    if (!state?.certificate) {
      continue;
    }

    // Return the raw certificate bytes — the gateway verifies server-side.
    // We don't attempt local verification because that requires fetchRootKey
    // which is only available on localhost replicas.
    const certBytes: Uint8Array =
      state.certificate instanceof Uint8Array
        ? state.certificate
        : new Uint8Array(state.certificate as ArrayBuffer);

    if (certBytes.length > 0) {
      return certBytes;
    }
  }

  throw new Error(
    `Timed out waiting for storage certificate after ${maxAttempts} attempts`,
  );
}

async function getCertificate(
  agent: HttpAgent,
  canisterId: string,
  hashString: string,
): Promise<Uint8Array> {
  const args = IDL.encode([IDL.Text], [hashString]);
  const result = await agent.call(canisterId, {
    methodName: "_caffeineStorageCreateCertificate",
    arg: args,
  });

  const body = result.response.body;

  // Happy path: synchronous v3 response with inline certificate
  if (isV3ResponseBody(body)) {
    return body.certificate;
  }

  // Async path: v2 response — poll readState for certificate bytes
  return pollForCertificate(agent, canisterId, result.requestId);
}

// ─── Gateway REST calls ──────────────────────────────────────────────────────

async function uploadBlobTree(
  storageGatewayUrl: string,
  treeJSON: BlobHashTreeJSON,
  bucketName: string,
  numBytes: number,
  owner: string,
  projectId: string,
  certificateBytes: Uint8Array,
): Promise<void> {
  const url = `${storageGatewayUrl}/${GATEWAY_VERSION}/blob-tree/`;
  const body = JSON.stringify({
    blob_tree: treeJSON,
    bucket_name: bucketName,
    num_blob_bytes: numBytes,
    owner,
    project_id: projectId,
    headers: treeJSON.headers,
    auth: { OwnerEgressSignature: Array.from(certificateBytes) },
  });

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Caffeine-Project-ID": projectId,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to upload blob tree: ${res.status} - ${text}`);
  }
}

async function uploadChunk(
  storageGatewayUrl: string,
  bucketName: string,
  projectId: string,
  owner: string,
  blobHash: string,
  chunkHash: string,
  chunkIndex: number,
  chunkData: Uint8Array,
): Promise<void> {
  const params = new URLSearchParams({
    owner_id: owner,
    blob_hash: blobHash,
    chunk_hash: chunkHash,
    chunk_index: chunkIndex.toString(),
    bucket_name: bucketName,
    project_id: projectId,
  });
  const url = `${storageGatewayUrl}/${GATEWAY_VERSION}/chunk/?${params}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Caffeine-Project-ID": projectId,
    },
    body: chunkData as BodyInit,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to upload chunk ${chunkIndex}: ${res.status} - ${text}`,
    );
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface BlobStorageStats {
  usedBytes: number;
  limitBytes: number;
}

/**
 * Fetch blob storage usage stats from the gateway.
 * Returns usedBytes and limitBytes (defaults to 2 GB limit if not provided).
 */
export async function getBlobStorageStats(): Promise<BlobStorageStats> {
  const config = await loadConfig();
  const url = `${config.storage_gateway_url}/${GATEWAY_VERSION}/bucket/stats/?bucket_name=${encodeURIComponent(config.bucket_name)}&project_id=${encodeURIComponent(config.project_id)}&owner_id=${encodeURIComponent(config.backend_canister_id)}`;

  try {
    const res = await fetch(url, {
      headers: { "X-Caffeine-Project-ID": config.project_id },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Gateway may return total_bytes, used_bytes, num_bytes, byte_count etc.
    const usedBytes =
      data.total_bytes ??
      data.used_bytes ??
      data.num_bytes ??
      data.byte_count ??
      0;
    const limitBytes =
      data.limit_bytes ?? data.quota_bytes ?? 2 * 1024 * 1024 * 1024; // 2 GB default
    return { usedBytes: Number(usedBytes), limitBytes: Number(limitBytes) };
  } catch {
    // Return zeros on failure — indicator will show gracefully
    return { usedBytes: 0, limitBytes: 2 * 1024 * 1024 * 1024 };
  }
}

/**
 * Upload raw bytes to blob storage and return the direct URL.
 * Uses an anonymous HttpAgent — the storage certificate endpoint is open
 * to all callers in the Caffeine blob-storage mixin.
 */
export async function uploadBytesToBlob(
  bytes: Uint8Array,
  _identity?: Identity,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const config = await loadConfig();

  // Always use an anonymous agent — the certificate endpoint is open
  const agent = new HttpAgent({
    host: config.backend_host,
  });

  if (config.backend_host?.includes("localhost")) {
    await agent.fetchRootKey().catch(() => {
      /* ignore in dev */
    });
  }

  const fileHeaders: Record<string, string> = {
    "Content-Type": "application/octet-stream",
    "Content-Length": bytes.length.toString(),
  };

  // 1. Split into chunks and compute hashes
  const chunks: Uint8Array[] = [];
  for (let start = 0; start < bytes.length; start += CHUNK_SIZE) {
    chunks.push(
      bytes.subarray(start, Math.min(start + CHUNK_SIZE, bytes.length)),
    );
  }

  const chunkHashes: Uint8Array[] = [];
  for (const chunk of chunks) {
    chunkHashes.push(await hashChunk(chunk));
  }

  // 2. Build the Merkle tree
  const {
    root,
    tree_type,
    headers: headerLines,
    chunk_hashes,
  } = await buildBlobHashTree(chunkHashes, fileHeaders);

  const blobHashString = toShaString(root.hash);
  const treeJSON = buildTreeJSON(root, tree_type, headerLines, chunk_hashes);

  // 3. Get a storage certificate from the backend (handles v2/v3 responses)
  const certificateBytes = await getCertificate(
    agent,
    config.backend_canister_id,
    blobHashString,
  );

  // 4. Register the blob tree with the gateway
  await uploadBlobTree(
    config.storage_gateway_url,
    treeJSON,
    config.bucket_name,
    bytes.length,
    config.backend_canister_id,
    config.project_id,
    certificateBytes,
  );

  // 5. Upload chunks
  const CONCURRENCY = 4;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, worker) => {
      for (let i = worker; i < chunks.length; i += CONCURRENCY) {
        await uploadChunk(
          config.storage_gateway_url,
          config.bucket_name,
          config.project_id,
          config.backend_canister_id,
          blobHashString,
          toShaString(chunkHashes[i]),
          i,
          chunks[i],
        );
        done++;
        if (chunks.length > 0) {
          onProgress?.(Math.round((done / chunks.length) * 100));
        }
      }
    }),
  );

  // Return the direct URL
  return `${config.storage_gateway_url}/${GATEWAY_VERSION}/blob/?blob_hash=${encodeURIComponent(blobHashString)}&owner_id=${encodeURIComponent(config.backend_canister_id)}&project_id=${encodeURIComponent(config.project_id)}`;
}
