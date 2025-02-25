import { IAIProvider } from './aiIProvider';

export abstract class BaseAIProvider implements IAIProvider {
  protected constructor(protected readonly apiKey: string) {}

  public validateApiKey(): void {
    if(!this.apiKey) {
      throw new Error(`${this.constructor.name} API key is not set. Please configure it in the settings.`);
    }
  }

  public async generateCompletion(prompt: string, code: string): Promise<string> {
    this.validateApiKey();
    const response = await this.callAPI(prompt, code);
    return this.formatResponse(response);
  }

    protected abstract callAPI(prompt: string, code: string): Promise<string>;

    protected formatResponse(response: string): string {
      return response
        .trim()
        .replace(/```dafny\n/g, '')
        .replace(/```/g, '');
    }
}