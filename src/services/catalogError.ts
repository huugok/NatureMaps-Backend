export class CatalogError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'CatalogError'
  }
}
