import { Command } from '@oclif/core';
import { FlagOutput } from '@oclif/core/lib/interfaces/parser';
import { Org, SfProject } from '@salesforce/core';



export default abstract class EonCommand extends Command {

    protected static requiresProject: boolean;

    protected hubOrg:Org;
    protected org:Org;
    protected project: SfProject;
    public flags: FlagOutput & { json: boolean; };


    protected static requiresUsername: boolean=false;
    protected static requiresDevhubUsername: boolean=false;


    /**
     * Command run code goes here
     */
    abstract execute(): Promise<any>;

    /**
     * Entry point of all commands
     */
    async run(): Promise<any> {
        //Always enable color by default




        this.flags = (await this.parse()).flags;

        if((this.statics.flags.targetusername || this.flags['target-org']) && this.statics.requiresUsername)
        {
            this.org = await Org.create({aliasOrUsername: this.flags.targetusername});
        }


        if(this.statics.flags.targetdevhubusername && this.statics.requiresDevhubUsername)
        {
            this.hubOrg = await Org.create({aliasOrUsername: this.flags.targetdevhubusername});
        }


        if (this.statics.requiresProject) {
            this.project = await SfProject.resolve();
        }


        // Execute command run code
        return await this.execute();
    }

    protected get statics(): typeof EonCommand {
        return this.constructor as typeof EonCommand;
    }

}
