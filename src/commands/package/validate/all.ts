import { Messages } from '@salesforce/core';
import  EonCommand  from '../../../EonCommand';
import { Flags } from '@oclif/core';
import * as os from 'os';
import UnlockedPackageImpl, {UnlockedPackageImplProps} from '../../../impl/validation/UnlockedPackageImpl';
import SourcePackageImpl, {SourcePackageImplProps} from '../../../impl/validation/SourcePackageImpl';
import EONLogger,{COLOR_HEADER} from '../../../eon/EONLogger';
import { LOGOBANNER } from '../../../eon/logo';

Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('@eon-com/eon-sfdx', 'validate_all');

export default class ValidateAll extends EonCommand {
  public static description = messages.getMessage('commandDescription');

  public static examples = messages.getMessage('examples').split(os.EOL);

  static flags = {
    // Label For Named Credential as Required
    'target-org': Flags.string({
      char: 't',
      description: messages.getMessage('targetOrgFlag'),
      required: true,
    }),
    'scratch-org': Flags.string({
      char: 's',
      description: messages.getMessage('scratchOrgFlag'),
      required: false,
    }),
    'target-devhub': Flags.string({
      char: 'd',
      description: messages.getMessage('targetDevHubFlag'),
      required: true,
    }),
    'run-scripts': Flags.boolean({
      char: 'r',
      description: messages.getMessage('runScriptsFlag'),
      default: false,
      required: false,
    }),
    pool: Flags.string({
      char: 'p',
      description: messages.getMessage('poolFlag'),
      required: true,
    }),
  };

  protected static requiresProject = true;

  public async execute(): Promise<void> {
      EONLogger.log(COLOR_HEADER(LOGOBANNER));
      const unlockedPackageImplProps: UnlockedPackageImplProps = {
          devHubAlias: this.flags['target-devhub'],
          scratchOrgAlias: this.flags['scratch-org'],
          runScripts: this.flags['run-scripts'],
          poolTag: this.flags.pool,
      };
      const unlockedPackageImpl = new UnlockedPackageImpl(unlockedPackageImplProps);
      await unlockedPackageImpl.exec();

      const sourcePackageImplProps: SourcePackageImplProps = {
          targetOrg: this.flags['target-org'],
          runScripts: this.flags['run-scripts']
      };

      const sourcePackageImpl = new SourcePackageImpl(sourcePackageImplProps);
      await sourcePackageImpl.exec();
  }
}
