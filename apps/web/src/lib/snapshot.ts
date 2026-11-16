/**
 * The world as it was on the last visit, kept in the browser so that the next visit has
 * something to draw at once. It is shown only until the store answers, which takes a moment,
 * and it is not shown at all once it is too old to be worth showing.
 *
 * It lives in IndexedDB, which takes a megabyte without complaint. Everything here may fail
 * (private windows, a full disk, a blocked store) and then simply does nothing.
 */

const NAME = "bearing";
const STORE = "kept";
const KEY = "world";
/**
 * What was kept by another build of the app is not read by this one: the shape of the world
 * may have changed between them, and nothing has to remember to say so.
 */
const VERSION = __BUILD__;
/** Older than this, the last visit says too little about now. */
const FRESH = 12 * 60 * 60 * 1000;

export interface Snapshot<Frame, Match> {
  frame: Frame;
  settled: Match[];
  live: Match[];
}

interface Kept<Frame, Match> extends Snapshot<Frame, Match> {
  version: string;
  at: number;
  /** Which store it was read from: a copy from another one is nobody's last visit. */
  from: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("The browser's store did not open."));
  });
}

export async function readSnapshot<Frame, Match>(
  from: string,
): Promise<Snapshot<Frame, Match> | null> {
  try {
    const db = await open();
    const kept = await new Promise<Kept<Frame, Match> | undefined>((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get(KEY);
      request.onsuccess = () => resolve(request.result as Kept<Frame, Match> | undefined);
      request.onerror = () => reject(request.error ?? new Error("Nothing could be read."));
    });
    db.close();
    if (!kept || kept.version !== VERSION || kept.from !== from) return null;
    if (Date.now() - kept.at > FRESH) return null;
    return kept;
  } catch {
    return null;
  }
}

export async function writeSnapshot<Frame, Match>(
  from: string,
  snapshot: Snapshot<Frame, Match>,
): Promise<void> {
  try {
    const db = await open();
    const kept: Kept<Frame, Match> = { ...snapshot, version: VERSION, at: Date.now(), from };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(kept, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Nothing could be written."));
    });
    db.close();
  } catch {
    // Not kept this time; the next visit loads as a first one does.
  }
}
