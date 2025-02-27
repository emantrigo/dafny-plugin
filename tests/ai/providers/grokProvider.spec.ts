import { GrokProvider } from '../../../src/ai/providers/grokProvider';
import { OpenAIBaseProvider } from '../../../src/ai/providers/base/openAIBaseProvider';

jest.mock('../../../src/ai/providers/base/openAIBaseProvider');

describe('GrokProvider', () => {
  const mockApiKey = 'test-api-key';
  let provider: GrokProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GrokProvider(mockApiKey);
  });

  describe('constructor', () => {
    it('creates GrokProvider instance', () => {
      expect(provider).toBeInstanceOf(GrokProvider);
    });

    it('extends OpenAIBaseProvider', () => {
      expect(provider).toBeInstanceOf(OpenAIBaseProvider);
    });

    it('passes API key to base provider', () => {
      expect(OpenAIBaseProvider).toHaveBeenCalledWith(mockApiKey);
    });
  });

  describe('modelName', () => {
    it('returns grok-2-latest as model name', () => {
      expect((provider as any).modelName).toBe('grok-2-latest');
    });
  });

  describe('inheritance', () => {
    it('uses OpenAIBaseProvider as prototype', () => {
      expect(Object.getPrototypeOf(GrokProvider.prototype)).toBe(OpenAIBaseProvider.prototype);
    });
  });
});
