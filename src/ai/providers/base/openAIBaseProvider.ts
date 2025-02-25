import { OpenAI } from 'openai';
import { BaseAIProvider } from './baseAIProvider';



export abstract class OpenAIBaseProvider extends BaseAIProvider {
  protected abstract get modelName(): string;

  protected async callAPI(prompt: string, code: string): Promise<string> {
    const openai = new OpenAI({
      apiKey: this.apiKey
    });

    try {
      const completion = await openai.chat.completions.create({
        model: this.modelName,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: code }
        ]
      });
      return completion.choices[0]?.message?.content ?? '';
    } catch(error: unknown) {
      if(error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error('An unknown error occurred while calling OpenAI API');
    }
  }
}