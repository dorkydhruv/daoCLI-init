ok so the logic is done with the cli tool, now all that remains is code structering to make it readable. I have created this list of tasks that need execution.
1. In integrated dao (dao+multisig_Squad) when the threshold is reached it automatically executes the transaction. That is not happening for normal dao as of right now.
2. The service folder should contain multiple folders of service and have index.ts exporting the required function for better readability.
3. Complete other commands of dao and proposal too. (FUTURE CONSIDERATION: because instructions can be multiple in a single proposal we should give a prompt for choosing which instruction they want to add. just give your thought on this)
4. Remove unnescarry fucntions, checks and console logs. (beautify them too) 
once that is done update the debug files for testing whether something broke.