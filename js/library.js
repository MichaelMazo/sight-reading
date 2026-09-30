// Pieces: built-in examples plus MusicXML files the user opened (kept in IndexedDB).

import { EXAMPLES } from './examples.js';
import { buildMusicXML } from './musicxml.js';

const DB_NAME = 'sight-reading';
const STORE = 'pieces';

export const DEFAULT_PIECE = `ex:${EXAMPLES[0].id}`;

export const builtInPieces = () => EXAMPLES.map((e) => ({ id: `ex:${e.id}`, title: e.title }));

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function userPieces() {
  try {
    const rows = await withStore('readonly', (s) => s.getAll());
    return rows.map((r) => ({ id: `user:${r.id}`, title: r.title }));
  } catch {
    return [];
  }
}

export async function getContent(id) {
  if (id.startsWith('ex:')) {
    const example = EXAMPLES.find((e) => `ex:${e.id}` === id);
    if (!example) throw new Error(`No example ${id}`);
    return buildMusicXML(example);
  }
  const row = await withStore('readonly', (s) => s.get(Number(id.slice(5))));
  if (!row) throw new Error(`No piece ${id}`);
  return row.content;
}

function readFile(file, binary) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    // Compressed .mxl is a zip; OpenSheetMusicDisplay takes it as a binary string.
    if (binary) reader.readAsBinaryString(file);
    else reader.readAsText(file);
  });
}

function titleFrom(xml, fileName) {
  const m = /<(?:work-title|movement-title)>([^<]+)</.exec(xml);
  return m ? m[1].trim() : fileName.replace(/\.(musicxml|xml|mxl)$/i, '');
}

export async function addFile(file) {
  const binary = /\.mxl$/i.test(file.name);
  const content = await readFile(file, binary);
  const title = binary ? file.name.replace(/\.mxl$/i, '') : titleFrom(content, file.name);
  const key = await withStore('readwrite', (s) => s.add({ title, fileName: file.name, content, addedAt: Date.now() }));
  return `user:${key}`;
}

export async function removePiece(id) {
  if (!id.startsWith('user:')) return;
  await withStore('readwrite', (s) => s.delete(Number(id.slice(5))));
}
