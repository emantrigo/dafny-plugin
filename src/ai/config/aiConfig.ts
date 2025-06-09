import * as vscode from 'vscode';
import { AIProviderType } from '../factory/aiProviderFactory';
import { FirebaseRemoteConfigService } from '../service/firebaseRemoteConfigService';
import { FirebaseSecretsService } from '../service/firebaseSecretsService';

export interface AIProviderConfiguration {
  apiKey: string;
  baseURL?: string;
}

export class AIConfiguration {
  private static readonly CONFIG_SECTION = 'dafny';
  private static remoteConfigService: FirebaseRemoteConfigService | null = null;
  private static secretsService: FirebaseSecretsService | null = null;

  private static readonly DEFAULT_BASE_URLS: Record<AIProviderType, string> = {
    'openai': 'https://api.openai.com/v1',
    'claude': 'https://api.anthropic.com/v1',
    'deepseek': 'https://api.deepseek.com',
    'grok': 'https://api.x.ai/v1'
  };

  private constructor() {}

  public static async initializeRemoteConfig(): Promise<void> {
    try {
      this.remoteConfigService = FirebaseRemoteConfigService.getInstance();
      await this.remoteConfigService.initialize();

      // Also initialize Secrets Manager
      this.secretsService = FirebaseSecretsService.getInstance();
      await this.secretsService.initialize();
    } catch(error: unknown) {
      console.warn('Failed to initialize Firebase services, using local settings:', error);
      this.remoteConfigService = null;
      this.secretsService = null;
    }
  }

  public static getProviderOrder(): AIProviderType[] {
    if(this.remoteConfigService) {
      return this.remoteConfigService.getAiProviderOrder();
    }
    return [ 'deepseek', 'openai', 'claude', 'grok' ];
  }

  public static getDefaultProvider(): AIProviderType {
    if(this.remoteConfigService) {
      return this.remoteConfigService.getDefaultAiProvider();
    }
    return this.getProviderOrder()[0];
  }

  public static async getConfiguration(): Promise<{
    providers: Record<AIProviderType, AIProviderConfiguration>,
    maxTries: number,
    aiProvider: AIProviderType
    }> {
    const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);

    // Get max retries from Remote Config if available
    const maxTries = this.remoteConfigService
      ? this.remoteConfigService.getMaxRetries()
      : (config.get('numberOfRetries') as number ?? 3);

    // Get default provider from Remote Config if available
    const aiProvider = (config.get('aiProvider') as AIProviderType) ?? this.getDefaultProvider();

    // Check if we should use Firebase Secrets for API keys
    const useFirebaseSecrets = this.remoteConfigService?.useFirebaseSecrets() ?? false;

    let apiKeys: Record<AIProviderType, string> = {
      openai: '',
      claude: '',
      deepseek: '',
      grok: ''
    };

    if(useFirebaseSecrets && this.secretsService) {
      try {
        console.log('🔐 Fetching API keys from Firebase Secrets...');
        const secrets = await this.secretsService.getAPIKeys();

        apiKeys = {
          openai: secrets.openai ?? (config.get('openAiApiKey') as string) ?? '',
          claude: secrets.claude ?? (config.get('claudeApiKey') as string) ?? '',
          deepseek: secrets.deepseek ?? (config.get('deepseekApiKey') as string) ?? '',
          grok: secrets.grok ?? (config.get('grokApiKey') as string) ?? ''
        };

        console.log('✅ Using API keys from Firebase Secrets with fallback to local settings');
      } catch(error: unknown) {
        console.warn('⚠️  Failed to fetch from Firebase Secrets, using local settings:', error);
        apiKeys = {
          openai: (config.get('openAiApiKey') as string) ?? '',
          claude: (config.get('claudeApiKey') as string) ?? '',
          deepseek: (config.get('deepseekApiKey') as string) ?? '',
          grok: (config.get('grokApiKey') as string) ?? ''
        };
      }
    } else {
      console.log('📝 Using API keys from local IDE settings');
      apiKeys = {
        openai: (config.get('openAiApiKey') as string) ?? '',
        claude: (config.get('claudeApiKey') as string) ?? '',
        deepseek: (config.get('deepseekApiKey') as string) ?? '',
        grok: (config.get('grokApiKey') as string) ?? ''
      };
    }

    return {
      providers: {
        openai: {
          apiKey: apiKeys.openai,
          baseURL: config.get('openAiBaseUrl')
                   ?? (this.remoteConfigService?.getBaseURLForProvider('openai'))
                   ?? this.DEFAULT_BASE_URLS.openai
        },
        claude: {
          apiKey: apiKeys.claude,
          baseURL: config.get('claudeBaseUrl')
                   ?? (this.remoteConfigService?.getBaseURLForProvider('claude'))
                   ?? this.DEFAULT_BASE_URLS.claude
        },
        deepseek: {
          apiKey: apiKeys.deepseek,
          baseURL: config.get('deepseekBaseUrl')
                   ?? (this.remoteConfigService?.getBaseURLForProvider('deepseek'))
                   ?? this.DEFAULT_BASE_URLS.deepseek
        },
        grok: {
          apiKey: apiKeys.grok,
          baseURL: config.get('grokBaseUrl')
                   ?? (this.remoteConfigService?.getBaseURLForProvider('grok'))
                   ?? this.DEFAULT_BASE_URLS.grok
        }
      },
      maxTries,
      aiProvider
    };
  }

  public static onConfigurationChanged(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if(event.affectsConfiguration(this.CONFIG_SECTION)) {
        callback();
      }
    });
  }

  public static isFeatureEnabled(feature: 'loopInvariants' | 'prePostConditions' | 'codeGeneration'): boolean {
    if(this.remoteConfigService) {
      return this.remoteConfigService.isFeatureEnabled(feature);
    }
    return true; // Default to enabled if no remote config
  }

  public static isProviderEnabled(provider: AIProviderType): boolean {
    if(this.remoteConfigService) {
      return this.remoteConfigService.isProviderEnabled(provider);
    }
    return true; // Default to enabled if no remote config
  }

  public static getModelForProvider(provider: AIProviderType): string | undefined {
    if(this.remoteConfigService) {
      return this.remoteConfigService.getModelForProvider(provider);
    }
    return undefined;
  }

  public static async refreshRemoteConfig(): Promise<boolean> {
    if(this.remoteConfigService) {
      return await this.remoteConfigService.refresh();
    }
    return false;
  }

  public static getProviderConfigurations(): Record<string, any> {
    if(this.remoteConfigService) {
      return this.remoteConfigService.getProviderConfig();
    }
    return {};
  }

  public static getRemoteConfigDebugInfo(): Record<string, any> {
    if(this.remoteConfigService) {
      return {
        providerOrder: this.remoteConfigService.getAiProviderOrder(),
        providerConfig: this.remoteConfigService.getProviderConfig(),
        maxRetries: this.remoteConfigService.getMaxRetries(),
        enabledFeatures: {
          loopInvariants: this.remoteConfigService.isFeatureEnabled('loopInvariants'),
          prePostConditions: this.remoteConfigService.isFeatureEnabled('prePostConditions'),
          codeGeneration: this.remoteConfigService.isFeatureEnabled('codeGeneration')
        }
      };
    }
    return { error: 'Remote config not available' };
  }
}