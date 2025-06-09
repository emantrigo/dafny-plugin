import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { FirebaseAdminConfigManager } from '../config/firebaseAdminConfig';
import { AIProviderType } from '../factory/aiProviderFactory';

export interface APIKeySecrets {
  openai?: string;
  claude?: string;
  deepseek?: string;
  grok?: string;
}

export class FirebaseSecretsService {
  private static instance: FirebaseSecretsService;
  private secretsClient: SecretManagerServiceClient | null = null;
  private projectId: string = '';
  private secretsCache: APIKeySecrets = {};
  private lastFetchTime = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  private constructor() {}

  public static getInstance(): FirebaseSecretsService {
    if(FirebaseSecretsService.instance === undefined) {
      FirebaseSecretsService.instance = new FirebaseSecretsService();
    }
    return FirebaseSecretsService.instance;
  }

  public async initialize(): Promise<void> {
    try {
      const firebaseManager = FirebaseAdminConfigManager.getInstance();

      if(!firebaseManager.isConfigured()) {
        console.warn('Firebase not configured, cannot use Secrets Manager');
        return;
      }

      const debugInfo = firebaseManager.getConfigDebugInfo();
      this.projectId = debugInfo.projectId;

      // Initialize Secrets Manager client with Service Account credentials
      const serviceAccountCredentials = firebaseManager.getServiceAccountCredentials();
      if(serviceAccountCredentials) {
        // Cast to any to access the raw JSON properties
        const rawCredentials = serviceAccountCredentials as any;

        this.secretsClient = new SecretManagerServiceClient({
          credentials: rawCredentials
        });
      } else {
        this.secretsClient = new SecretManagerServiceClient();
      }

      console.log('✅ Firebase Secrets Manager initialized');
      console.log(`🔍 Project ID: ${this.projectId}`);
      console.log(`🔍 Service Account configured: ${firebaseManager.isConfigured()}`);
    } catch(error: unknown) {
      console.error('Failed to initialize Firebase Secrets Manager:', error);
      this.secretsClient = null;
    }
  }

  public async getAPIKeys(): Promise<APIKeySecrets> {
    if(!this.secretsClient || !this.projectId) {
      console.warn('Secrets Manager not available, returning cached values');
      return this.secretsCache;
    }

    // Check cache first
    const now = Date.now();
    if(now - this.lastFetchTime < this.CACHE_DURATION && Object.keys(this.secretsCache).length > 0) {
      console.log('Using cached API keys from Secrets Manager');
      return this.secretsCache;
    }

    try {
      const secrets: APIKeySecrets = {};

      // Define secret names for each provider
      const secretNames = {
        openai: 'openai-api-key',
        claude: 'claude-api-key',
        deepseek: 'deepseek-api-key',
        grok: 'grok-api-key'
      };

      // Fetch all secrets in parallel
      const secretPromises = Object.entries(secretNames).map(async ([ provider, secretName ]) => {
        try {
          const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
          console.log(`🔍 Trying to access: ${name}`);
          const [ version ] = await this.secretsClient!.accessSecretVersion({ name });

          if(version.payload?.data) {
            const secretValue = version.payload.data.toString();
            if(secretValue?.trim()) {
              secrets[ provider as keyof APIKeySecrets ] = secretValue.trim();
              console.log(`✅ Loaded ${provider} API key from Firebase Secrets`);
            }
          }
        } catch(error: unknown) {
          // Only log as warning if it's not a "not found" error
          if(error && typeof error === 'object' && 'code' in error && (error as any).code === 5) {
            console.log(`ℹ️  Secret ${secretName} not found, skipping ${provider} provider`);
          } else {
            console.error(`⚠️  Could not load ${provider} API key from Secrets Manager:`, error);
            if(error && typeof error === 'object' && 'code' in error) {
              console.error(`🔍 Error code: ${(error as any).code}`);
            }
          }
        }
      });

      await Promise.all(secretPromises);

      this.secretsCache = secrets;
      this.lastFetchTime = now;

      console.log(`🔐 Fetched ${Object.keys(secrets).length} API keys from Firebase Secrets`);

      return secrets;

    } catch(error: unknown) {
      console.error('Error fetching API keys from Secrets Manager:', error);
      return this.secretsCache;
    }
  }

  public async getAPIKeyForProvider(provider: AIProviderType): Promise<string | null> {
    const secrets = await this.getAPIKeys();
    return secrets[ provider ] ?? null;
  }

  public isConfigured(): boolean {
    return this.secretsClient !== null && Boolean(this.projectId);
  }

  public getDebugInfo(): any {
    return {
      isConfigured: this.isConfigured(),
      projectId: this.projectId,
      cacheSize: Object.keys(this.secretsCache).length,
      lastFetchTime: this.lastFetchTime,
      cacheAge: this.lastFetchTime ? Date.now() - this.lastFetchTime : 0,
      availableProviders: Object.keys(this.secretsCache)
    };
  }

  public async refreshSecrets(): Promise<APIKeySecrets> {
    this.lastFetchTime = 0; // Force refresh
    return await this.getAPIKeys();
  }
}