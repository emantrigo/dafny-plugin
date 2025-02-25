import { Anthropic } from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base/baseAIProvider';

export class ClaudeProvider extends BaseAIProvider {
  private static readonly MODEL_NAME = 'claude-3-opus-20240229';

  public constructor(apiKey: string) {
    super(apiKey);
  }

  protected async callAPI(prompt: string, code: string): Promise<string> {
    const anthropic = new Anthropic({
      apiKey: this.apiKey
    });

    try {
      const message = await anthropic.messages.create({
        model: ClaudeProvider.MODEL_NAME,
        max_tokens: 1000,
        messages: [
          { role: 'assistant', content: prompt },
          { role: 'user', content: code }
        ]
      });

      return message.content[0].type === 'text' ? message.content[0].text : '';
    } catch(error: unknown) {
      if(error instanceof Error) {
        throw new Error(`Claude API error: ${error.message}`);
      }
      throw new Error('An unknown error occurred while calling Claude API');
    }
  }
}