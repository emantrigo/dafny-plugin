import { OpenAIBaseProvider } from './base/openAIBaseProvider';

export class OpenAIProvider extends OpenAIBaseProvider {
  private static readonly MODEL_NAME = 'gpt-4o';

  public constructor(apiKey: string) {
    super(apiKey);
  }

  protected get modelName(): string {
    return OpenAIProvider.MODEL_NAME;
  }
}