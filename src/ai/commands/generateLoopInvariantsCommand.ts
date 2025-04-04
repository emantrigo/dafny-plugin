import { AIProviderType } from '../factory/aiProviderFactory';
import { DafnyLanguageClient } from '../../language/dafnyLanguageClient';
import { BaseCodeGenerationCommand } from './baseCodeGenerationCommand';

export class GenerateLoopInvariantsCommand extends BaseCodeGenerationCommand {
  public constructor(client: DafnyLanguageClient) {
    super(client);
  }

  protected getPrompt(lastErrors: string[]): string {
    let prompt
      = 'Analyze the following Dafny code. Add appropriate loop invariants and fix any errors you find. '
      + 'Do not change the original code structure or functionality. Only add loop invariants and fix errors. '
      + 'Provide the resulting code without any explanations or additional text:';

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
