'use strict';

const path = require('path');
const chalk = require('chalk');
const { requireCredentials } = require('../auth');
const { findEnvFiles, updateEnvFile } = require('../env');

module.exports = function (program) {
  program
    .command('connect [dir]')
    .description('Fill Whop credentials into .env files in a project directory')
    .option('--overwrite', 'Overwrite existing non-empty values')
    .action((dir = '.', opts) => {
      const creds = requireCredentials();
      const targetDir = path.resolve(dir);

      console.log(chalk.bold(`\n⚡ CashMoto Connect → ${targetDir}\n`));

      const files = findEnvFiles(targetDir);
      if (!files.length) {
        console.log(chalk.yellow('No .env files found.'));
        console.log(chalk.gray('Checked: ' + ['.env', '.env.local', '.env.example', '.env.production', '.env.development'].join(', ')));
        return;
      }

      const vars = {
        WHOP_API_KEY: creds.api_key,
        WHOP_COMPANY_ID: creds.company_id,
      };

      let anyChange = false;
      for (const file of files) {
        const rel = path.relative(process.cwd(), file);
        const result = updateEnvFile(file, vars, { overwrite: opts.overwrite });

        const changed = result.updated.length + result.added.length;
        if (!changed && !Object.keys(result.skipped).length) continue;

        console.log(chalk.bold(rel));
        for (const key of result.updated) {
          console.log(chalk.green(`  ✓ ${key}`));
          anyChange = true;
        }
        for (const key of result.added) {
          console.log(chalk.green(`  + ${key}  ${chalk.gray('(added)')}`));
          anyChange = true;
        }
        for (const [key] of Object.entries(result.skipped)) {
          console.log(chalk.yellow(`  ~ ${key}  ${chalk.gray('(already set — use --overwrite to replace)')}`));
        }
        console.log();
      }

      if (!anyChange && files.length) {
        console.log(chalk.gray('All Whop vars already set. Use --overwrite to force.'));
      }

      console.log(chalk.gray('Next: cashmoto webhook <url> --dir <path>   →  fills WHOP_WEBHOOK_SECRET'));
    });
};
