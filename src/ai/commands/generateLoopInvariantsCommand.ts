import { AIProviderType } from '../factory/aiProviderFactory';
import { DafnyLanguageClient } from '../../language/dafnyLanguageClient';
import { BaseCodeGenerationCommand } from './baseCodeGenerationCommand';
import { loopInvariantsPrompt } from './prompts/loopInvariantsPrompt';

export class GenerateLoopInvariantsCommand extends BaseCodeGenerationCommand {
  public constructor(client: DafnyLanguageClient) {
    super(client);
  }

  protected getPrompt(lastErrors: string[]): string {
    let prompt = loopInvariantsPrompt;

    if(lastErrors.length > 0) {
      prompt
        += '\n\nThe previous attempt resulted in the following errors. Please address these specifically:\n'
        + lastErrors.join('\n');
    }

    return prompt;
  }

  protected getStatusMessage(
    provider: AIProviderType,
    attempt: number,
    maxTries: number
  ): string {
    return `Generating loop invariants with ${provider}... (Attempt ${attempt}/${maxTries})`;
  }

  protected getSuccessMessage(
    provider: AIProviderType,
    attempt: number,
    maxTries: number
  ): string {
    return `Success! Loop invariants added and errors fixed using ${provider} (Attempt ${attempt}/${maxTries})`;
  }
}
