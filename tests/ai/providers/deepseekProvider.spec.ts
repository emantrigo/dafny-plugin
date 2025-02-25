import { DeepseekProvider } from '../../../src/ai/providers/deepseekProvider';
import { OpenAIBaseProvider } from '../../../src/ai/providers/base/openAIBaseProvider';

jest.mock('../../../src/ai/providers/base/openAIBaseProvider');

describe('DeepseekProvider', () => {
  const mockApiKey = 'test-api-key';
  let provider: DeepseekProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new DeepseekProvider(mockApiKey);
  });

  describe('constructor', () => {
    it('creates DeepseekProvider instance', () => {
      expect(provider).toBeInstanceOf(DeepseekProvider);
    });

    it('extends OpenAIBaseProvider', () => {
      expect(provider).toBeInstanceOf(OpenAIBaseProvider);
    });

    it('passes API key to base provider', () => {
      expect(OpenAIBaseProvider).toHaveBeenCalledWith(mockApiKey);
    });
  });

  describe('modelName', () => {
    it('returns deepseek-chat as model name', () => {
      expect((provider as any).modelName).toBe('deepseek-chat');
    });
  });

  describe('inheritance', () => {
    it('uses OpenAIBaseProvider as prototype', () => {
      expect(Object.getPrototypeOf(DeepseekProvider.prototype)).toBe(OpenAIBaseProvider.prototype);
    });
  });
});