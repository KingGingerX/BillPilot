'use strict';

const chalk = require('chalk');
const { requireCredentials } = require('../auth');
const { WhopAPI } = require('../api');

module.exports = function (program) {
  program
    .command('list')
    .description('List products and optionally plans for your Whop company')
    .option('--plans', 'Show plans for each product')
    .action(async (opts) => {
      const creds = requireCredentials();
      const api = new WhopAPI(creds.api_key);

      console.log(chalk.bold(`\n⚡ ${creds.company_title || creds.company_id}\n`));

      let products;
      try {
        products = await api.listProducts(creds.company_id);
      } catch (err) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }

      if (!products.length) {
        console.log(chalk.gray('No products yet.'));
        console.log(chalk.gray('Run: cashmoto create'));
        return;
      }

      for (const p of products) {
        const vis = p.visibility ? chalk.gray(` [${p.visibility}]`) : '';
        console.log(chalk.bold(p.title) + vis);
        console.log(chalk.gray(`  ID:      ${p.id}`));
        console.log(chalk.gray(`  Members: ${p.member_count || 0}`));

        if (opts.plans) {
          let plans = [];
          try {
            plans = await api.listPlans(p.id);
          } catch {
            // plans endpoint may not always be accessible
          }

          if (plans.length) {
            for (let i = 0; i < plans.length; i++) {
              const plan = plans[i];
              const isLast = i === plans.length - 1;
              const prefix = isLast ? '  └──' : '  ├──';

              const price = plan.initial_price != null ? `$${plan.initial_price}` : 'free';
              const type = plan.plan_type === 'renewal'
                ? `${price} / ${plan.billing_period}d`
                : `${price} one-time`;

              console.log(chalk.cyan(`${prefix} ${plan.id}`) + chalk.gray(`  ${type}`));
              if (plan.purchase_url) {
                const linkPrefix = isLast ? '     ' : '  │  ';
                console.log(chalk.gray(`${linkPrefix} ${plan.purchase_url}`));
              }
            }
          } else {
            console.log(chalk.gray('  └── no plans'));
          }
        }
        console.log();
      }

      if (!opts.plans) {
        console.log(chalk.gray('Tip: cashmoto list --plans  shows pricing for each product'));
      }
    });
};
