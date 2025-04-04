import {
  AIProviderFactory,
  AIProviderType
} from '../factory/aiProviderFactory';
import { AIConfiguration } from '../config/aiConfig';

export class AiService {
  /**
   * Calls the AI provider to generate a completion
   *
   * @param prompt The instruction prompt to send to the AI
   * @param code The code context to send to the AI
   * @param provider The AI provider to use
   * @returns The AI-generated completion
   * @throws Error if the AI provider fails to generate a completion
   */
  public static async callAI(
    prompt: string,
    code: string,
    provider: AIProviderType
  ): Promise<string> {
    try {
      const config = AIConfiguration.getConfiguration();
      const providerConfig = config.providers[provider];

      const aiProvider = AIProviderFactory.createProvider({
        type: provider,
        apiKey: providerConfig.apiKey,
        baseURL: providerConfig.baseURL
      });

      return await aiProvider.generateCompletion(prompt, code);
    } catch(error: unknown) {
      if(error instanceof Error) {
        throw new Error(`${provider} API error: ${error.message}`);
      }
      throw new Error(
        `An unknown error occurred while calling ${provider} API`
      );
    }
  }
}
