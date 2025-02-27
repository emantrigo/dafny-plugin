import { IAIProvider } from '../providers/base/aiIProvider';
import { ClaudeProvider } from '../providers/claudeProvider';
import { DeepseekProvider } from '../providers/deepseekProvider';
import { GrokProvider } from '../providers/grokProvider';
import { OpenAIProvider } from '../providers/openAIProvider';


export type AIProviderType = 'openai' | 'claude' | 'deepseek' | 'grok';

export interface AIProviderConfig {
  type: AIProviderType;
  apiKey: string;
  baseURL?: string;
}

export class AIProviderFactory {
  public static createProvider(config: AIProviderConfig): IAIProvider {
    switch(config.type) {
    case 'openai':
      return new OpenAIProvider(config.apiKey);
    case 'claude':
      return new ClaudeProvider(config.apiKey);
    case 'deepseek':
      return new DeepseekProvider(config.apiKey, config.baseURL);
    case 'grok':
      return new GrokProvider(config.apiKey, config.baseURL);
    default:
      throw new Error(`Unsupported AI provider: ${config.type}`);
    }
  }
}