import { FirebaseAdminConfigManager } from '../config/firebaseAdminConfig';
import { AIProviderType } from '../factory/aiProviderFactory';

export interface ProviderConfig {
  modelName: string;
  baseURL: string;
}

export interface RemoteConfigDefaults {
  // Main Firebase Remote Config keys (matching your Firebase setup)
  llm_max_tries: number;
  llm_provider_config: string; // JSON string with provider configurations
  llm_provider_order: string; // JSON array of provider names

  // Additional feature flags (can be added to Firebase later)
  enableLoopInvariants: boolean;
  enablePrePostConditions: boolean;
  enableCodeGeneration: boolean;
  enableAdvancedPrompts: boolean;
  enableContextOptimization: boolean;

  // API Keys source control
  useFirebaseSecrets: boolean;
}

export class FirebaseRemoteConfigService {
  private static instance: FirebaseRemoteConfigService;
  private configManager: FirebaseAdminConfigManager | null = null;
  private remoteConfigData: Record<string, any> = {};
  private isInitialized = false;

  private readonly defaults: RemoteConfigDefaults = {
    llm_max_tries: 3,
    llm_provider_config: JSON.stringify({
      'deepseek': {
        'modelName': 'deepseek-chat',
        'baseURL': 'https://api.deepseek.com'
      },
      'openai': {
        'modelName': 'gpt-4',
        'baseURL': 'https://api.openai.com/v1'
      },
      'claude': {
        'modelName': 'claude-3-opus-20240229',
        'baseURL': 'https://api.anthropic.com/v1'
      },
      'grok': {
        'modelName': 'grok-2-latest',
        'baseURL': 'https://api.x.ai/v1'
      }
    }),
    llm_provider_order: JSON.stringify([ 'deepseek', 'openai', 'claude', 'grok' ]),
    enableLoopInvariants: true,
    enablePrePostConditions: true,
    enableCodeGeneration: true,
    enableAdvancedPrompts: false,
    enableContextOptimization: true,
    useFirebaseSecrets: false
  };

  private constructor() {}

  public static getInstance(): FirebaseRemoteConfigService {
    if(FirebaseRemoteConfigService.instance === undefined) {
      FirebaseRemoteConfigService.instance = new FirebaseRemoteConfigService();
    }
    return FirebaseRemoteConfigService.instance;
  }

  public async initialize(): Promise<void> {
    if(this.isInitialized) {
      return;
    }

    try {
      this.configManager = FirebaseAdminConfigManager.getInstance();

      if(!this.configManager.isConfigured()) {
        console.warn('Firebase not configured, using local defaults');
        this.isInitialized = true;
        return;
      }

      // Fetch remote config data
      this.remoteConfigData = await this.configManager.fetchRemoteConfig();

      this.isInitialized = true;
      console.log('✅ Firebase Remote Config initialized successfully');
    } catch(error: unknown) {
      console.error('Failed to initialize Firebase Remote Config:', error);
      console.warn('Falling back to local defaults');
      this.isInitialized = true;
    }
  }

  public async fetchAndActivate(): Promise<boolean> {
    if(!this.configManager) {
      return false;
    }

    try {
      this.remoteConfigData = await this.configManager.fetchRemoteConfig();
      return true;
    } catch(error: unknown) {
      console.error('Failed to fetch and activate remote config:', error);
      return false;
    }
  }

  public getDefaultAiProvider(): AIProviderType {
    const providerOrder = this.getAiProviderOrder();
    return providerOrder[0] || 'deepseek';
  }

  public getAiProviderOrder(): AIProviderType[] {
    const value = this.remoteConfigData['llm_provider_order'];
    if(value) {
      try {
        return Array.isArray(value) ? value : JSON.parse(value);
      } catch{
        // Fall through to default
      }
    }
    return JSON.parse(this.defaults.llm_provider_order);
  }

  public getProviderConfig(): Record<AIProviderType, ProviderConfig> {
    const value = this.remoteConfigData['llm_provider_config'];
    if(value) {
      try {
        return typeof value === 'object' ? value : JSON.parse(value);
      } catch{
        // Fall through to default
      }
    }
    return JSON.parse(this.defaults.llm_provider_config);
  }

  public isProviderEnabled(provider: AIProviderType): boolean {
    // Check if provider exists in the provider config
    const providerConfig = this.getProviderConfig();
    return provider in providerConfig;
  }

  public isFeatureEnabled(feature: 'loopInvariants' | 'prePostConditions' | 'codeGeneration'): boolean {
    const enableKey = `enable${feature.charAt(0).toUpperCase() + feature.slice(1)}` as keyof RemoteConfigDefaults;
    const value = this.remoteConfigData[enableKey];

    if(value !== undefined) {
      return Boolean(value);
    }

    return this.defaults[enableKey] as boolean;
  }

  public getMaxRetries(): number {
    const value = this.remoteConfigData['llm_max_tries'];
    if(value !== undefined) {
      return typeof value === 'number' ? value : parseInt(value) || this.defaults.llm_max_tries;
    }
    return this.defaults.llm_max_tries;
  }

  public getTimeout(): number {
    // Default timeout since it's not in your Firebase config yet
    return 30000;
  }

  public getModelForProvider(provider: AIProviderType): string {
    const providerConfig = this.getProviderConfig();
    return providerConfig[provider]?.modelName || '';
  }

  public getBaseURLForProvider(provider: AIProviderType): string {
    const providerConfig = this.getProviderConfig();
    return providerConfig[provider]?.baseURL || '';
  }

  public isAdvancedPromptsEnabled(): boolean {
    const value = this.remoteConfigData['enableAdvancedPrompts'];
    if(value !== undefined) {
      return Boolean(value);
    }
    return this.defaults.enableAdvancedPrompts;
  }

  public isContextOptimizationEnabled(): boolean {
    const value = this.remoteConfigData['enableContextOptimization'];
    if(value !== undefined) {
      return Boolean(value);
    }
    return this.defaults.enableContextOptimization;
  }

  public getAllConfig(): Record<string, any> {
    return Object.keys(this.remoteConfigData).length > 0 ? this.remoteConfigData : this.defaults;
  }

  public useFirebaseSecrets(): boolean {
    const value = this.remoteConfigData['useFirebaseSecrets'];
    if(value !== undefined) {
      return Boolean(value);
    }
    return this.defaults.useFirebaseSecrets;
  }

  public async refresh(): Promise<boolean> {
    return await this.fetchAndActivate();
  }
}