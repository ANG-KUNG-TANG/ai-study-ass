
let acessToken: string | null = null;

export function getAccessToken(): string | null {
    return acessToken
}

export function setAccessToken(token: string | null) : void {
    acessToken=token;
}