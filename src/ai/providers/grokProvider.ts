import { OpenAIBaseProvider } from './base/openAIBaseProvider';

export class GrokProvider extends OpenAIBaseProvider {
  private static readonly MODEL_NAME = 'grok-2-latest';

  public constructor(apiKey: string, baseURL?: string) {
    super(apiKey, baseURL);
  }

  protected get modelName(): string {
    return GrokProvider.MODEL_NAME;
  }
}