'use strict';

const path = require('path');
const inquirer = require('inquirer');
const chalk = require('chalk');
const { requireCredentials } = require('../auth');
const { WhopAPI } = require('../api');
const { findEnvFiles, updateEnvFile } = require('../env');

const DEFAULT_EVENTS = [
  'payment.succeeded',
  'payment.failed',
  'membership.went_valid',
  'membership.went_invalid',
  'membership.was_cancelled',
];

function validateUrl(v) {
  try {
    const u = new URL(v);
    return (u.protocol === 'https:' || u.protocol === 'http:') || 'Must be a valid URL';
  } catch {
    return 'Must be a valid URL';
  }
}

module.exports = function (program) {
  program
    .command('webhook [url]')
    .description('Register a Whop webhook endpoint and auto-fill signing secret into .env')
    .option('--dir <path>', 'Auto-fill WHOP_WEBHOOK_SECRET into .env files here')
    .option('--list', 'List all registered webhooks')
    .option('--delete <id>', 'Delete a webhook by ID')
    .action(async (url, opts) => {
      const creds = requireCredentials();
      const api = new WhopAPI(creds.api_key);

      if (opts.list) {
        console.log(chalk.bold('\n⚡ Registered Webhooks\n'));
        try {
          const hooks = await api.listWebhooks();
          if (!hooks.length) {
            console.log(chalk.gray('No webhooks registered.'));
          } else {
            for (const h of hooks) {
              const status = h.enabled !== false ? chalk.green('enabled') : chalk.gray('disabled');
              console.log(`${chalk.bold(h.id)}  [${status}]`);
              console.log(chalk.gray(`  URL:    ${h.url}`));
              if (h.events && h.events.length) {
                console.log(chalk.gray(`  Events: ${h.events.join(', ')}`));
              }
              console.log();
            }
          }
        } catch (err) {
          console.error(chalk.red(`Error: ${err.message}`));
          process.exit(1);
        }
        return;
      }

      if (opts.delete) {
        process.stdout.write(chalk.gray(`Deleting ${opts.delete}... `));
        try {
          await api.deleteWebhook(opts.delete);
          console.log(chalk.green('✓ Deleted'));
        } catch (err) {
          console.log(chalk.red('✗'));
          console.error(chalk.red(`Error: ${err.message}`));
          process.exit(1);
        }
        return;
      }

      console.log(chalk.bold('\n⚡ Register Whop Webhook\n'));

      if (!url) {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'url',
            message: 'Webhook endpoint URL:',
            validate: validateUrl,
          },
        ]);
        url = answers.url;
      } else {
        const err = validateUrl(url);
        if (err !== true) {
          console.error(chalk.red(`Invalid URL: ${err}`));
          process.exit(1);
        }
      }

      let hook;
      process.stdout.write(chalk.gray('Registering... '));
      try {
        hook = await api.createWebhook({
          url,
          events: DEFAULT_EVENTS,
          enabled: true,
        });
        console.log(chalk.green('✓'));
      } catch (err) {
        console.log(chalk.red('✗'));
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }

      console.log('\n' + chalk.bold.green('✓ Webhook registered!\n'));
      console.log(chalk.bold('ID:             ') + chalk.cyan(hook.id));
      console.log(chalk.bold('URL:            ') + chalk.cyan(hook.url));
      console.log(chalk.bold('Signing Secret: ') + chalk.yellow(hook.webhook_secret));
      console.log(chalk.bold('Events:         ') + chalk.gray(DEFAULT_EVENTS.join(', ')));
      console.log();

      if (opts.dir) {
        const targetDir = path.resolve(opts.dir);
        const files = findEnvFiles(targetDir);
        if (files.length) {
          for (const file of files) {
            const rel = path.relative(process.cwd(), file);
            const result = updateEnvFile(file, { WHOP_WEBHOOK_SECRET: hook.webhook_secret });
            console.log(chalk.bold(rel));
            for (const key of result.updated) console.log(chalk.green(`  ✓ ${key}`));
            for (const key of result.added) console.log(chalk.green(`  + ${key}  ${chalk.gray('(added)')}`));
            for (const [key] of Object.entries(result.skipped)) console.log(chalk.yellow(`  ~ ${key}  ${chalk.gray('(already set)')}`));
          }
        } else {
          console.log(chalk.yellow(`No .env files found in ${targetDir}`));
          console.log(chalk.gray(`Add manually: WHOP_WEBHOOK_SECRET=${hook.webhook_secret}`));
        }
      } else {
        console.log(chalk.gray('Add to .env:'));
        console.log(`  WHOP_WEBHOOK_SECRET=${hook.webhook_secret}`);
        console.log();
        console.log(chalk.gray('Auto-fill: cashmoto webhook <url> --dir <path>'));
      }

      console.log();
    });
};
