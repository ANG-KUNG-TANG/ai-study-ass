//UserEntity
/**
 * where the centralize rules, uniformity of user's modle flow
 * pure domain object, No mongoose, no bcrypt, no https cncern
 * single soure of truth for all user
 * every other layers (model, validaotr, servie) will apply rulet
 * if rules change, must change in entity layer
 */

import { ValidationError } from "../utils/errors";

export const USER_RULES = {
    name: {
        minLength: 2,
        maxLength: 100
    },
    password: {
        minLength: 8,
        maxLength: 78,

        requireUppercase: true,
        requiredNumber: true,
    },
    emailVerificaition:{
        expiresInMs: 24 * 60 * 60 * 1000,
    }
} as const;

//value types
export type UserId =string;
export type UserRole = "user" | "admin";

export interface UserProps{
    id: UserId;
    name: string;
    email: string,
    passwordHash: string,
    role: UserRole;
    isActive: Boolean;
    emailVerificationToken: string | null;
    emailVerificationExpires: Date | null;
    refreshTokenId: string | null;
    createdAt :Date;
    updatedAt: Date;

}

export interface UserPublicProfile {
    id: UserId,
    name: string,
    email: string,
    role: UserRole,
    isActive: Boolean,
    createdAt: Date;
    updateAt: Date;
}

//Domain validation
//these functions are the ruls. validators and models mirror them -nvever replace them

function validateName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length < USER_RULES.name.minLength) {
        throw new ValidationError("Validation failed",{
            name: `Name cannot exceed ${USER_RULES.name.minLength} characters`,
        });
    }

    if (trimmed.length > USER_RULES.name.maxLength){
        throw new ValidationError("Validaiotn failed", {
            name: `Name cannot exceed ${USER_RULES.name.maxLength} characters`,
        })
    }
}

function validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^/s@]+$/;
    if (!emailRegex.test(email.trim())){
        throw new ValidationError("Validation failed", {
            email: "Invalid email format"
        });
    }
}

export function validatePasswordStrength(password: string): void {
    if (password.length < USER_RULES.password.minLength) {
        throw new ValidationError("Validaiton failed", {
            password: `Password must be at lest ${USER_RULES.password.minLength} characters`
        })
    }
    if (password.length > USER_RULES.password.maxLength) {
        throw new ValidationError("Validaiton failed", {
            password: `Password must be at lest ${USER_RULES.password.maxLength} characters`,
        })
    }
    if (USER_RULES.password.requireUppercase && !/[A-Z]/.test(password)){
        throw new ValidationError("Validaiton failed", {
            password: "Password must contian at leat one uppercase letter"
        })
    }
    if (USER_RULES.password.requiredNumber && !/[0-9]/.test(password)){
        throw new ValidationError("Validaiton failed", {
            password: "Passwod must contian at leat one number"
        })
    }
}

//Entity
/**
 * all fields are private (#). External code can only read via getters
 * mutuation is impossible -no setter. new stat = new enitty form reposistory.
 * this gurantees the object is awaly valid - you cannot construct a broken UserEntity
 * 
 */

export class UserEntity {
    //keywoard (#) fiels are  truly inaccessible outside this class.
    readonly #id: UserId;
    readonly #name: string;
    readonly #email: string;
    readonly #passwordHash: string;
    readonly #role: UserRole;
    readonly #isActive: Boolean;
    readonly #emailVerificationToken: string | null;
    readonly #emailVerificationExpires: Date | null;
    readonly #refreshTokenId : string | null;
    readonly #createdAt: Date;
    readonly #updatedAt: Date;

    private constructor(props: UserProps){
        this.#id = props.id;
        this.#name = props.name;
        this.#email = props.email;
        this.#passwordHash = props.passwordHash;
        this.#role = props.role;
        this.#isActive = props.isActive;
        this.#emailVerificationToken = props.emailVerificationToken;
        this.#emailVerificationExpires = props.emailVerificationExpires;
        this.#refreshTokenId = props.refreshTokenId;
        this.#createdAt = props.createdAt;
        this.#updatedAt = props.updatedAt;
    }

    //Getter -controlled read access
    get if(): UserId {return this.#id}
    get name(): string { return this.#name}
    get email(): string { return this.email}
    get passwordHash(): string {return this.#passwordHash}
    get refreshTokenId(): string | null { return this.#refreshTokenId}
    get role(): UserRole { return this.#role}
    get isActive(): boolean { return this.#isActive;}
    get emailVerificationToken(): string | null { return this.#emailVerificationToken}
    get emailVerificationExpires(): string | null { return this.#emailVerificationExpires}
    get createdAt(): Date { return this.#createdAt; }
    get updatedAt(): Date {return this.#updatedAt}
    

    //Factory : create new user
    /**
     * isactive = false until email verified.
     * role always start as "user" -admins are assigned manully in DB or by another admin
     * receive verificaionToken generated by authService (randomUUID or crypto token);
     */

    static create(input: {
        id: UserId;
        name: string;
        email: string;
        passwordHash: string;
        emailVerificaitonToken: string;
    }): UserEntity{
        validateName(input.name);
        validateEmail(input.email);

        const expiresAt = new Date(
            Date.now() + USER_RULES.emailVerificaition.expiresInMs
        );

    return new UserEntity({
            id:input.id,
            name: input.name.trim(),
            email: input.email.toLowerCase().trim(),
            passwordHash: input.passwordHash,
            role: "user",
            isActive: false,

            emailVerificationToken: input.emailVerificaitonToken,
            emailVerificationExpires: expiresAt,
            refreshTokenId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    };

    //factory : reconstitue from db
    static fromPersistence(props: UserProps): UserEntity{
        return new UserEntity(props);
    }

    //domain behaviour

    isAdmin(): boolean {
        return this.#role === 'admin';
    }

    hasActiveSession(): boolean {
        return this.#refreshTokenId !== null;
    }

    //checks if this user can login -auth service calls this befor issuing tokesn
    canLogin(): { allowed: boolean; reason?: string} {
        if (!this.#isActive){
            return {
                allowed: false,
                reason: "Account not verified - please check your email",
            }
        }
        return { allowed: true}
    }
    
    //check is a verificaion token is valid and not expired
    isVerificaionTokenValid(token: string): boolean {
        if (!this.#emailVerificationToken || !this.#emailVerificationExpires)
        {
            return false;
        }
        if (this.#emailVerificationToken !== token) return false;
        if ( new Date() > this.#emailVerificationExpires) return false;
        return true;
    }

    // serialisaiton
    //for api responses = never includes sensitive fields
    toPublic(): UserPublicProfile{
        return {
            id: this.#id,
            name: this.#name,
            email: this.#email,
            role: this.#role,
            isActive: this.#isActive,
            createdAt: this.createdAt,
            updateAt: this.updatedAt,
        }
    }

    //for repository writes only full snapshot including sensitive files
    toPersistence(): UserProps{
        return {
            id: this.#id,
            name: this.#name,
            email: this.#email,
            passwordHash: this.#passwordHash,
            role: this.#role,
            isActive: this.isActive,
            emailVerificationToken: this.#emailVerificationToken,
            emailVerificationExpires: this.#emailVerificationExpires,
            refreshTokenId: this.#refreshTokenId,
            createdAt: this.#createdAt,
            updatedAt: this.#updatedAt
        };
    }
    
}

