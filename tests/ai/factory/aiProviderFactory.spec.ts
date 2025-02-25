import { AIProviderFactory, AIProviderType } from '../../../src/ai/factory/aiProviderFactory';
import { OpenAIProvider } from '../../../src/ai/providers/openAIProvider';
import { ClaudeProvider } from '../../../src/ai/providers/claudeProvider';
import { DeepseekProvider } from '../../../src/ai/providers/deepseekProvider';
import { GrokProvider } from '../../../src/ai/providers/grokProvider';

describe('AIProviderFactory', () => {
  const apiKey = 'test-api-key';

  it('creates OpenAI provider', () => {
    const provider = AIProviderFactory.createProvider({ type: 'openai', apiKey });
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('creates Claude provider', () => {
    const provider = AIProviderFactory.createProvider({ type: 'claude', apiKey });
    expect(provider).toBeInstanceOf(ClaudeProvider);
  });

  it('creates Deepseek provider', () => {
    const provider = AIProviderFactory.createProvider({ type: 'deepseek', apiKey });
    expect(provider).toBeInstanceOf(DeepseekProvider);
  });

  it('creates Grok provider', () => {
    const provider = AIProviderFactory.createProvider({ type: 'grok', apiKey });
    expect(provider).toBeInstanceOf(GrokProvider);
  });

  it('throws error for unsupported provider', () => {
    const invalidType = 'invalid' as AIProviderType;
    expect(() => AIProviderFactory.createProvider({ type: invalidType, apiKey })).toThrow('Unsupported AI provider: invalid');
  });

  it('throws an error for invalid provider type', () => {
    const invalidType = 'invalid' as AIProviderType;
    expect(() => AIProviderFactory.createProvider({ type: invalidType, apiKey })).toThrow('Unsupported AI provider: invalid');
  });
});
