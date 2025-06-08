import { AIProviderType } from '../factory/aiProviderFactory';
import { DafnyLanguageClient } from '../../language/dafnyLanguageClient';
import { BaseCodeGenerationCommand } from './baseCodeGenerationCommand';
import { loopInvariantsPrompt } from './prompts/loopInvariantsPrompt';
import { prePostConditionsPrompt } from './prompts/prePostConditionsPrompt';

export class GenerateCodeCommand extends BaseCodeGenerationCommand {
  public constructor(client: DafnyLanguageClient) {
    super(client);
  }

  protected getPrompt(lastErrors: string[]): string {
    // Analyze the errors to determine what needs to be generated
    const needsLoopInvariants = lastErrors.some(
      (error) =>
        error.toLowerCase().includes('loop')
        || error.toLowerCase().includes('invariant')
    );

    const needsPrePostConditions = lastErrors.some(
      (error) =>
        error.toLowerCase().includes('requires')
        || error.toLowerCase().includes('ensures')
    );

    let prompt = '';

    if(needsLoopInvariants && needsPrePostConditions) {
      // If both are needed, combine both prompts
      prompt = `${loopInvariantsPrompt}\n\n${prePostConditionsPrompt}`;
    } else if(needsLoopInvariants) {
      prompt = loopInvariantsPrompt;
    } else if(needsPrePostConditions) {
      prompt = prePostConditionsPrompt;
    } else {
      // If no specific errors are detected, use both prompts
      prompt = `${loopInvariantsPrompt}\n\n${prePostConditionsPrompt}`;
    }

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
    return `Generating code with ${provider}... (Attempt ${attempt}/${maxTries})`;
  }

  protected getSuccessMessage(
    provider: AIProviderType,
    attempt: number,
    maxTries: number
  ): string {
    return `Success! Code generated and errors fixed using ${provider} (Attempt ${attempt}/${maxTries})`;
  }
}
