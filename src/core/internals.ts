import { randomText, randomInteger } from "./helpers";

let internalState = {
    secrets: {}
};

export function createSecret(key: string, len: number = 8, includeLetters: boolean = true, includeDigits: boolean = false, prefix: string = null) {
    let secret: string;
    if (internalState.secrets.hasOwnProperty(key)) {
        // TODO: warn?
        secret = internalState.secrets[key];

        if (secret.indexOf(prefix) !== 0) {
            // TODO: warn?
        }
    } else {
        let rand: string = "";
        if (includeLetters) {
            rand = randomText(len, includeDigits);
        } else if (includeDigits) {
            for (let i = 0; i < len; i++) {
                rand += randomInteger(0, 9).toString();
            }
        } else {
            // TODO: warn?
        }

        if (prefix) {
            secret = prefix + rand;
        } else {
            secret = rand;
        }

        internalState.secrets[key] = secret;
    }

    return secret;
}

export function getSecret(key: string): string {
    let secret: string;

    if (internalState.secrets.hasOwnProperty(key)) {
        secret = internalState.secrets[key];
    } else {
        // TODO: warn?
    }

    return secret;
}
