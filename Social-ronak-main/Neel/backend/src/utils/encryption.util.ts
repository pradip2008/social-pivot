import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';

function getSecretKey(): Buffer {
    const rawKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!rawKey) {
        throw new Error(
            'ENCRYPTION_KEY or JWT_SECRET environment variable must be set. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
        );
    }
    return crypto.createHash('sha256').update(String(rawKey)).digest();
}

export function encryptToken(text: string | null | undefined): string | null {
    if (!text) return text as any;
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, getSecretKey(), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    } catch (e) {
        console.error('Encryption failed', e);
        return text;
    }
}

export function decryptToken(encryptedText: string | null | undefined): string | null {
    if (!encryptedText) return encryptedText as any;
    // Basic check if it follows our "iv:encrypted" format
    if (!encryptedText.includes(':') || encryptedText.split(':').length !== 2) return encryptedText;

    try {
        const [ivHex, dataHex] = encryptedText.split(':');
        // Validate IV length (16 bytes = 32 hex chars)
        if (ivHex.length !== 32) return encryptedText;
        
        const iv = Buffer.from(ivHex, 'hex');
        const encryptedData = Buffer.from(dataHex, 'hex');
        const decipher = crypto.createDecipheriv(algorithm, getSecretKey(), iv);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // If decryption fails, the text might not be encrypted (migration phase)
        return encryptedText;
    }
}
