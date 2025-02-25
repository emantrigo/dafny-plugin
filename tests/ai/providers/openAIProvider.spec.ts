import { OpenAIBaseProvider } from '../../../src/ai/providers/base/openAIBaseProvider';
import { OpenAIProvider } from '../../../src/ai/providers/openAIProvider';

jest.mock('../../../src/ai/providers/base/openAIBaseProvider');

describe('OpenAIProvider', () => {
  const mockApiKey = 'test-api-key';
  let provider: OpenAIProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OpenAIProvider(mockApiKey);
  });

  describe('constructor', () => {
    it('creates OpenAIProvider instance', () => {
      expect(provider).toBeInstanceOf(OpenAIProvider);
    });

    it('extends OpenAIBaseProvider', () => {
      expect(provider).toBeInstanceOf(OpenAIBaseProvider);
    });

    it('passes API key to base provider', () => {
      expect(OpenAIBaseProvider).toHaveBeenCalledWith(mockApiKey);
    });
  });

  describe('modelName', () => {
    it('returns gpt-4o as model name', () => {
      expect((provider as any).modelName).toBe('gpt-4o');
    });
  });

  describe('inheritance', () => {
    it('uses OpenAIBaseProvider as prototype', () => {
      expect(Object.getPrototypeOf(OpenAIProvider.prototype)).toBe(OpenAIBaseProvider.prototype);
    });
  });
});