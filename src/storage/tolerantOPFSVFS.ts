import { OriginPrivateFileSystemVFS } from 'wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js'

const SQLITE_OK = 0

// SQLite frequently calls xDelete on journal files that may or may not
// exist — after a clean COMMIT it asks the VFS to delete the rollback
// journal even though the previous step already removed it, and on a
// fresh database it asks to delete journals it never created. SQLite's
// xDelete contract explicitly permits returning SQLITE_OK in the
// "file was missing" case (the docs recommend SQLITE_IOERR_DELETE_NOENT
// but treat OK as benign).
//
// The wa-sqlite OriginPrivateFileSystemVFS calls
// `await directoryHandle.removeEntry(filename)` without catching the
// OPFS NotFoundError, which propagates as a JS exception into the wasm
// bridge. wa-sqlite-async cannot translate JS exceptions to result codes
// from inside an async VFS callback — it aborts the entire SQLite
// session with "memory access out of bounds" / "Aborted: unreachable".
// The base implementation also fires-and-forgets removeEntry when
// syncDir=0, which leaves the rejection as an unhandled promise.
//
// This subclass replaces xDelete with a single-await implementation
// that swallows NotFoundError. We can't reuse the base class's private
// #getPathComponents helper, so we walk the OPFS path here. The other
// VFS methods are inherited unchanged.
export class TolerantOPFSVFS extends OriginPrivateFileSystemVFS {
  xDelete(name: string, syncDir: number): number | Promise<number> {
    void syncDir
    return this.handleAsync<number>(async () => {
      try {
        const url = new URL(name, 'http://localhost/')
        const segments = url.pathname.split('/').filter((s) => s.length > 0)
        if (segments.length === 0) return SQLITE_OK

        let dir: FileSystemDirectoryHandle = await navigator.storage.getDirectory()
        for (let i = 0; i < segments.length - 1; i++) {
          dir = await dir.getDirectoryHandle(segments[i])
        }
        await dir.removeEntry(segments[segments.length - 1])
        return SQLITE_OK
      } catch (err) {
        if (isNotFound(err)) return SQLITE_OK
        throw err
      }
    })
  }
}

function isNotFound(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'name' in err &&
    (err as { name: string }).name === 'NotFoundError'
  )
}
