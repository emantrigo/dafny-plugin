import { OpenAIBaseProvider } from './base/openAIBaseProvider';

export class DeepseekProvider extends OpenAIBaseProvider {
  private static readonly MODEL_NAME = 'deepseek-chat';

  public constructor(apiKey: string) {
    super(apiKey);
  }

  protected get modelName(): string {
    return DeepseekProvider.MODEL_NAME;
  }
}