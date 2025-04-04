import { AIProviderType } from '../factory/aiProviderFactory';
import { DafnyLanguageClient } from '../../language/dafnyLanguageClient';
import { BaseCodeGenerationCommand } from './baseCodeGenerationCommand';

export class GeneratePrePostConditionsCommand extends BaseCodeGenerationCommand {
  public constructor(client: DafnyLanguageClient) {
    super(client);
  }

  protected getPrompt(lastErrors: string[]): string {
    let prompt
      = 'Analyze the following Dafny code. Add appropriate preconditions (requires clauses) and '
      + 'postconditions (ensures clauses) to methods and functions. Do not change the original code structure or functionality. '
      + 'Only add pre/post conditions and fix any related errors. Provide the resulting code without any explanations or additional text:';

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
    return `Generating pre/post conditions with ${provider}... (Attempt ${attempt}/${maxTries})`;
  }

  protected getSuccessMessage(
    provider: AIProviderType,
    attempt: number,
    maxTries: number
  ): string {
    return `Success! Pre/post conditions added and errors fixed using ${provider} (Attempt ${attempt}/${maxTries})`;
  }
}
