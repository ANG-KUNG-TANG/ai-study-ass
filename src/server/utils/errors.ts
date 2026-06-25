//Base

export class AppError extends Error {
    readonly statusCode: number;
    readonly code : string;

    //isoperaional = true means
    //false = unexpected bug
    readonly isOperatinal: boolean;

    constructor(
        message:string,
        statusCode: number,
        code: string,
        isOperational = true
    ) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.code = code;
        this.isOperatinal=isOperational;

        //Restore prototype chain -needed when extending built-in classes in Ts
        Object.setPrototypeOf(this, new.target.prototype);

        //remove constructor call from stack trace so it points at the throw site
        Error.captureStackTrace(this, this.constructor);
    }
}

// 400 bad Request
export class BadRequestError extends AppError {
    constructor(message = "Bad request"){
        super(message, 400, "BAD_REQUEST");
    }
}

//401 Unauthorized
export class UnauthorizedError extends AppError {
    constructor(message = 'Authenticaiton required'){
        super(message, 401, "UNAUTHORIZED");
    }
}

// 403 forbidden
export class ForbiddenError extends AppError {
    constructor(message = `You don't have the permission to perform this action`){
        super(message, 403, 'FORBIDDEN')
    }
}

//404 Not Found
export class NotFoundError extends AppError {
    constructor(resource = "Resource"){
        super(`${resource} not found`, 404, "NOT_FOUND")
    }
}

//409 Conflict
export class ConflictError extends AppError {
    constructor(message = 'Resource already exist'){
        super(message, 409, "CONFLICT");
    }
}

//422 validation
export class ValidationError extends AppError {
    readonly fields?: Record<string, string>;

    constructor(message = "Validation failed", fields?: Record<string, string>){
        super(message, 422, 'VALIDATION_ERROR');
        this.fields = fields;
    }
}

//429 Rate limit
export class RateLImitError extends AppError {
    readonly retryAfterMs?: number;

    constructor(message = "Too many request", retryAfterMs?: number){
        super(message, 429, "RATE_LIMIT_EXCEEDED");
        this.retryAfterMs = retryAfterMs;
    }
}

//400 File Error
export class FileError extends AppError {
    constructor(message = 'File processing failed'){
        super(message, 400, "FILE_ERROR");
    }
}

//502 AI Error
export class AIError extends AppError {
    readonly provider?: string;
    constructor(message = "AI service unavailable", provider?: string){
        super(message, 502, "AI_ERROR");
        this.provider = provider
    }
}


// 500 Internal 
export class InternalErro extends AppError {
    constructor(message = "Internal server error"){
        super(message, 500, "INTERNAL_ERROR", false);
    }
}

//Type guard
export function isAppError(err: unknown): err is AIError{
    return err instanceof AppError;
}