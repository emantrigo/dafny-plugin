export interface IAIProvider {
    validateApiKey(): void;
    generateCompletion(prompt: string, code: string): Promise<string>;
}