export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const errors = {
  unauthorized: (message = 'Not authenticated') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Not permitted') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message = 'Conflict') => new AppError(409, 'CONFLICT', message),
  validation: (message = 'Invalid input', details?: unknown) =>
    new AppError(422, 'VALIDATION_ERROR', message, details),
  emailTaken: () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists'),
  invalidCredentials: () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'),
  tokenInvalid: (message = 'Invalid or expired token') => new AppError(401, 'TOKEN_INVALID', message),
}
