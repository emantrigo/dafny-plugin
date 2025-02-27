import { Anthropic } from '@anthropic-ai/sdk';
import { ClaudeProvider } from '../../../src/ai/providers/claudeProvider';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk');

describe('ClaudeProvider', () => {
  const mockApiKey = 'test-api-key';
  let provider: ClaudeProvider;

  beforeEach(() => {
    provider = new ClaudeProvider(mockApiKey);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('creates an instance with the provided API key', () => {
      expect(provider).toBeInstanceOf(ClaudeProvider);
    });
  });

  describe('callAPI', () => {
    const mockPrompt = 'Test prompt';
    const mockCode = 'Test code';
    const mockResponse = {
      content: [
        {
          type: 'text',
          text: 'Test response'
        }
      ]
    };

    let mockCreate: jest.Mock;

    beforeEach(() => {
      mockCreate = jest.fn();
      ((Anthropic as unknown) as jest.Mock).mockImplementation(() => ({
        messages: { create: mockCreate }
      }));
    });

    it('initializes Anthropic client with correct API key', async () => {
      mockCreate.mockResolvedValue(mockResponse);
      await (provider as any).callAPI(mockPrompt, mockCode);
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: mockApiKey });
    });

    it('calls API with correct parameters', async () => {
      mockCreate.mockResolvedValue(mockResponse);
      await (provider as any).callAPI(mockPrompt, mockCode);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        messages: [
          { role: 'assistant', content: mockPrompt },
          { role: 'user', content: mockCode }
        ]
      });
    });

    it('returns text from successful response', async () => {
      mockCreate.mockResolvedValue(mockResponse);
      const result = await (provider as any).callAPI(mockPrompt, mockCode);
      expect(result).toBe('Test response');
    });

    it('returns empty string for non-text response', async () => {
      const nonTextResponse = {
        content: [ { type: 'image', text: null } ]
      };
      mockCreate.mockResolvedValue(nonTextResponse);

      const result = await (provider as any).callAPI(mockPrompt, mockCode);
      expect(result).toBe('');
    });

    it('handles API error with message', async () => {
      const mockError = new Error('API Error');
      mockCreate.mockRejectedValue(mockError);

      await expect((provider as any).callAPI(mockPrompt, mockCode))
        .rejects
        .toThrow('Claude API error: API Error');
    });

    it('handles unknown API error', async () => {
      mockCreate.mockRejectedValue('Unknown error');

      await expect((provider as any).callAPI(mockPrompt, mockCode))
        .rejects
        .toThrow('An unknown error occurred while calling Claude API');
    });
  });
});