export class ApiError extends Error {
  constructor(statusCode, message, errors = []) {
    super(message);
    this.statusCode    = statusCode;
    this.errors        = errors;
    this.isOperational = true;
  }
  static badRequest(msg, errors)         { return new ApiError(400, msg, errors); }
  static unauthorized(msg = 'Unauthorized') { return new ApiError(401, msg); }
  static forbidden(msg = 'Forbidden')       { return new ApiError(403, msg); }
  static notFound(msg = 'Not found')        { return new ApiError(404, msg); }
  static conflict(msg)                      { return new ApiError(409, msg); }
  static internal(msg = 'Server error')     { return new ApiError(500, msg); }
}