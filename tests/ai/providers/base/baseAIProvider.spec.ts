import { BaseAIProvider } from '../../../../src/ai/providers/base/baseAIProvider';

// Concrete implementation for testing
class TestAIProvider extends BaseAIProvider {
  public constructor(apiKey: string) {
    super(apiKey);
  }

  protected callAPI(prompt: string, code: string): Promise<string> {
    return Promise.resolve(`Response for prompt: ${prompt} and code: ${code}`);
  }

  public formatResponseForTest(response: string): string {
    return this.formatResponse(response);
  }
}

describe('BaseAIProvider', () => {
  let provider: TestAIProvider;

  beforeEach(() => {
    provider = new TestAIProvider('valid-key');
  });

  describe('validateApiKey', () => {
    it('throws error when API key is empty', () => {
      const provider = new TestAIProvider('');
      expect(() => provider.validateApiKey())
        .toThrow('TestAIProvider API key is not set. Please configure it in the settings.');
    });

    it('completes successfully with valid API key', () => {
      expect(() => provider.validateApiKey()).not.toThrow();
    });

    it('throws error when API key is undefined', () => {
      const provider = new TestAIProvider(undefined as unknown as string);
      expect(() => provider.validateApiKey())
        .toThrow('TestAIProvider API key is not set. Please configure it in the settings.');
    });
  });

  describe('generateCompletion', () => {
    it('validates API key before calling API', async () => {
      const provider = new TestAIProvider('');
      await expect(provider.generateCompletion('prompt', 'code'))
        .rejects
        .toThrow('TestAIProvider API key is not set. Please configure it in the settings.');
    });

    it('calls API with provided prompt and code', async () => {
      const result = await provider.generateCompletion('test prompt', 'test code');
      expect(result).toBe('Response for prompt: test prompt and code: test code');
    });

    it('formats API response', async () => {
      const spy = jest.spyOn(provider as any, 'formatResponse');
      await provider.generateCompletion('prompt', 'code');
      expect(spy).toHaveBeenCalled();
    });

    it('passes API response to formatResponse', async () => {
      const spy = jest.spyOn(provider as any, 'formatResponse');
      await provider.generateCompletion('test prompt', 'test code');
      expect(spy).toHaveBeenCalledWith('Response for prompt: test prompt and code: test code');
    });
  });

  describe('formatResponse', () => {
    it('trims whitespace from response', () => {
      const response = provider.formatResponseForTest('  test response  ');
      expect(response).toBe('test response');
    });

    it('removes dafny code blocks', () => {
      const response = provider.formatResponseForTest('```dafny\ntest code\n```');
      expect(response).toBe('test code\n');
    });

    it('removes general code blocks', () => {
      const response = provider.formatResponseForTest('```\ntest code\n```');
      expect(response).toBe('\ntest code\n');
    });

    it('handles multiple code blocks', () => {
      const response = provider.formatResponseForTest(
        '```dafny\ncode1\n```\ntext\n```\ncode2\n```'
      );
      expect(response).toBe('code1\n\ntext\n\ncode2\n');
    });

    it('handles empty response', () => {
      const response = provider.formatResponseForTest('');
      expect(response).toBe('');
    });

    it('handles response with only whitespace', () => {
      const response = provider.formatResponseForTest('   \n   \t   ');
      expect(response).toBe('');
    });
  });
});