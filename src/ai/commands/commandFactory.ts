import { DafnyLanguageClient } from '../../language/dafnyLanguageClient';
import { GenerateLoopInvariantsCommand } from './generateLoopInvariantsCommand';
import { GeneratePrePostConditionsCommand } from './generatePrePostConditionsCommand';
import { GenerateCodeCommand } from './generateCodeCommand';

/**
 * Factory for creating code generation commands
 */
export class CommandFactory {
  /**
   * Creates a command for generating loop invariants
   *
   * @param client The Dafny language client
   * @returns A command for generating loop invariants
   */
  public static createGenerateLoopInvariantsCommand(
    client: DafnyLanguageClient
  ): GenerateLoopInvariantsCommand {
    return new GenerateLoopInvariantsCommand(client);
  }

  /**
   * Creates a command for generating pre/post conditions
   *
   * @param client The Dafny language client
   * @returns A command for generating pre/post conditions
   */
  public static createGeneratePrePostConditionsCommand(
    client: DafnyLanguageClient
  ): GeneratePrePostConditionsCommand {
    return new GeneratePrePostConditionsCommand(client);
  }

  /**
   * Creates a command for intelligently generating both loop invariants and pre/post conditions
   * based on the code's needs
   *
   * @param client The Dafny language client
   * @returns A command for generating code
   */
  public static createGenerateCodeCommand(
    client: DafnyLanguageClient
  ): GenerateCodeCommand {
    return new GenerateCodeCommand(client);
  }
}
