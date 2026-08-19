import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'

export interface FileStorageProvider {
  put(key: string, data: Buffer, contentType: string): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}

export class LocalFileStorage implements FileStorageProvider {
  constructor(private rootDir: string) {}

  private pathFor(key: string): string {
    if (key.includes('..') || key.includes('/') || key.includes('\\')) {
      throw new Error(`Invalid storage key: ${key}`)
    }
    const path = normalize(join(this.rootDir, key))
    if (!path.startsWith(normalize(this.rootDir))) throw new Error(`Invalid storage key: ${key}`)
    return path
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data)
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key))
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }
}
