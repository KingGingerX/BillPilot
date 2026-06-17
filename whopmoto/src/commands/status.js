'use strict';

const chalk = require('chalk');
const { loadCredentials } = require('../auth');
const { WhopAPI } = require('../api');

module.exports = function (program) {
  program
    .command('status')
    .description('Show stored credentials and validate connection')
    .action(async () => {
      const creds = loadCredentials();

      console.log(chalk.bold('\n⚡ CashMoto Status\n'));

      if (!creds) {
        console.log(chalk.red('Not logged in.'));
        console.log(chalk.gray('Run: cashmoto login'));
        return;
      }

      const key = creds.api_key || '';
      const masked = '*'.repeat(Math.max(0, key.length - 4)) + key.slice(-4);

      console.log(chalk.bold('Company:  ') + (creds.company_title || creds.company_id));
      console.log(chalk.bold('ID:       ') + chalk.cyan(creds.company_id));
      console.log(chalk.bold('API Key:  ') + chalk.gray(masked));
      if (creds.saved_at) {
        console.log(chalk.bold('Saved:    ') + chalk.gray(new Date(creds.saved_at).toLocaleString()));
      }

      process.stdout.write(chalk.gray('\nValidating... '));
      try {
        const api = new WhopAPI(creds.api_key);
        const products = await api.listProducts(creds.company_id);
        console.log(chalk.green(`✓ Connected  (${products.length} product${products.length !== 1 ? 's' : ''})`));
      } catch (err) {
        console.log(chalk.red(`✗ ${err.message}`));
        console.log(chalk.gray('Re-authenticate: cashmoto login'));
      }
      console.log();
    });
};
