'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const { WhopAPI } = require('../api');
const { saveCredentials } = require('../auth');

module.exports = function (program) {
  program
    .command('login')
    .description('Save your Whop API key and select your company')
    .action(async () => {
      console.log(chalk.bold('\n⚡ CashMoto Login\n'));

      const { apiKey } = await inquirer.prompt([
        {
          type: 'password',
          name: 'apiKey',
          message: 'Whop API key:',
          mask: '*',
          validate: (v) => v.trim().length > 0 || 'API key required',
        },
      ]);

      const api = new WhopAPI(apiKey.trim());

      let company = null;

      // Try Apps API first (x-api-key on data.whop.com)
      process.stdout.write(chalk.gray('Connecting... '));
      try {
        const current = await api.getCurrentCompany();
        console.log(chalk.green('✓'));
        if (current && current.id) {
          company = { id: current.id, title: current.title || current.name || current.id };
          console.log(chalk.gray(`  ${company.title} (${company.id})`));
        }
      } catch {
        // Try REST API fallback (Bearer on api.whop.com)
        try {
          const companies = await api.listCompanies();
          if (companies.length === 1) {
            company = companies[0];
            console.log(chalk.green('✓'));
            console.log(chalk.gray(`  ${company.title} (${company.id})`));
          } else if (companies.length > 1) {
            console.log(chalk.green('✓'));
            const { companyId } = await inquirer.prompt([
              {
                type: 'list',
                name: 'companyId',
                message: 'Select company:',
                choices: companies.map((c) => ({
                  name: `${c.title}  ${chalk.gray(c.id)}`,
                  value: c.id,
                })),
              },
            ]);
            company = companies.find((c) => c.id === companyId);
          }
        } catch {
          console.log(chalk.gray('skipped'));
        }
      }

      // Manual entry if auto-fetch failed or returned nothing
      if (!company) {
        console.log(chalk.gray('  Enter company details manually.'));
        console.log(chalk.gray('  Company ID: dash.whop.com → URL shows /company/biz_xxxxx\n'));

        const { companyId, companyTitle } = await inquirer.prompt([
          {
            type: 'input',
            name: 'companyId',
            message: 'Company ID:',
            validate: (v) => v.trim().length > 0 || 'Required',
          },
          {
            type: 'input',
            name: 'companyTitle',
            message: 'Company name (for display):',
            default: 'My Company',
          },
        ]);
        company = { id: companyId.trim(), title: companyTitle.trim() };
      }

      saveCredentials({
        api_key: apiKey.trim(),
        company_id: company.id,
        company_title: company.title,
        saved_at: new Date().toISOString(),
      });

      console.log(chalk.green(`\n✓ Logged in as ${chalk.bold(company.title)}`));
      console.log(chalk.gray('  cashmoto connect --dir <path>   fill .env files'));
      console.log(chalk.gray('  cashmoto create                 create product + plan'));
      console.log(chalk.gray('  cashmoto list                   list products'));
    });
};
