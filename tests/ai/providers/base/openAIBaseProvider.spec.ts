import { OpenAI } from 'openai';
import { OpenAIBaseProvider } from '../../../../src/ai/providers/base/openAIBaseProvider';
import { jest } from '@jest/globals';

jest.mock('openai');

class TestOpenAIProvider extends OpenAIBaseProvider {
  public constructor(apiKey: string) {
    super(apiKey);
  }

  protected get modelName(): string {
    return 'test-model';
  }

  public async testCallAPI(prompt: string, code: string): Promise<string> {
    return this.callAPI(prompt, code);
  }
}

describe('OpenAIBaseProvider', () => {
  let provider: TestOpenAIProvider;
  let mockOpenAI: jest.Mocked<OpenAI>;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new TestOpenAIProvider('test-api-key');
    mockOpenAI = {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    } as unknown as jest.Mocked<OpenAI>;

    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI);
  });

  describe('callAPI', () => {
    const testPrompt = 'test prompt';
    const testCode = 'test code';
    const expectedResponse = 'API response';

    it('returns expected response from API', async (): Promise<void> => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [ { message: { content: expectedResponse } } ]
      } as any);

      const result = await provider.testCallAPI(testPrompt, testCode);

      expect(result).toBe(expectedResponse);
    });

    it('initializes OpenAI with correct API key', async (): Promise<void> => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [ { message: { content: expectedResponse } } ]
      } as any);

      await provider.testCallAPI(testPrompt, testCode);

      expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('calls API with correct parameters', async (): Promise<void> => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [ { message: { content: expectedResponse } } ]
      } as any);

      await provider.testCallAPI(testPrompt, testCode);

      const apiCall = mockOpenAI.chat.completions.create.mock.calls[0][0];

      expect(apiCall).toEqual({
        model: 'test-model',
        messages: [
          { role: 'system', content: testPrompt },
          { role: 'user', content: testCode }
        ]
      });
    });

    it('returns empty string for null content', async (): Promise<void> => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [ { message: { content: null } } ]
      } as any);

      const result = await provider.testCallAPI(testPrompt, testCode);

      expect(result).toBe('');
    });

    it('returns empty string when choices array is empty', async (): Promise<void> => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: []
      } as any);

      const result = await provider.testCallAPI(testPrompt, testCode);

      expect(result).toBe('');
    });

    it('returns empty string when message is undefined', async (): Promise<void> => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [ { } ]
      } as any);

      const result = await provider.testCallAPI(testPrompt, testCode);

      expect(result).toBe('');
    });

    it('throws specific error message on Error instance', async (): Promise<void> => {
      const errorMessage = 'API error occurred';
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error(errorMessage));

      await expect(provider.testCallAPI(testPrompt, testCode))
        .rejects
        .toThrow(`OpenAI API error: ${errorMessage}`);
    });

    it('throws generic error on unknown error type', async (): Promise<void> => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce('Unknown error');

      await expect(provider.testCallAPI(testPrompt, testCode))
        .rejects
        .toThrow('An unknown error occurred while calling OpenAI API');
    });
  });
});
