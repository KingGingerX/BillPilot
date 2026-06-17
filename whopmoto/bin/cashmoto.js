#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const { version } = require('../package.json');

program
  .name('cashmoto')
  .description('Whop credential manager and project auto-provisioner')
  .version(version);

require('../src/commands/login')(program);
require('../src/commands/logout')(program);
require('../src/commands/status')(program);
require('../src/commands/connect')(program);
require('../src/commands/create')(program);
require('../src/commands/list')(program);
require('../src/commands/webhook')(program);
require('../src/commands/inject')(program);

program.parse(process.argv);
