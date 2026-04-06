import fs from 'fs-extra';
import path from 'path';
import vscriptsApi from '@moddota/dota-data/files/vscripts/api';
import vscriptsApiTypes from '@moddota/dota-data/files/vscripts/api-types';
import vscriptsEnums from '@moddota/dota-data/files/vscripts/enums';
import events from '@moddota/dota-data/files/events';
import botsData from '../files/bots/api.json';
import { GENERATED_HEADER } from './constants/generated-header';
import { WrapDescriptionFormatter } from './formatters/wrap-description-formatter';
import { InlineDescFormatter } from './formatters/inline-desc-formatter';
import { DeclWriter } from './writers/decl-writer';
import { VscriptsMapper } from './mappers/vscripts-mapper';
import { BotsMapper } from './mappers/bots-mapper';
import type { BotApiSchema } from './mappers/bots-mapper';
import { DeclarationsMerger } from './mergers/declarations-merger';
import { UnknownTypesResolver } from './resolvers/unknown-types-resolver';
import { DependencyGraphResolver } from './resolvers/dependency-graph-resolver';
import { TopoSortResolver } from './resolvers/topo-sort-resolver';

const wrapFormatter = new WrapDescriptionFormatter();
const inlineFormatter = new InlineDescFormatter();
const writer = new DeclWriter(wrapFormatter, inlineFormatter);

const vscriptsDecls = new VscriptsMapper(vscriptsApi, vscriptsApiTypes, vscriptsEnums, events).map();
const botsDecls = new BotsMapper(botsData as BotApiSchema).map();
const merged = new DeclarationsMerger().merge(botsDecls, vscriptsDecls);
const resolved = new UnknownTypesResolver().resolve(merged);
const graph = new DependencyGraphResolver().resolve(resolved);
const sorted = new TopoSortResolver().resolve(resolved, graph);

// Inform the writer which names are enums so return stubs use proper enum values
const enumNames = new Set(resolved.filter((d) => d.kind === 'enum').map((d) => d.name));
const enumFirstMember = new Map<string, string>();
for (const d of resolved) {
  if (d.kind === 'enum' && d.members.length > 0) {
    enumFirstMember.set(d.name, d.members[0].name);
  }
}
writer.setEnumNames(enumNames);
writer.setEnumFirstMembers(enumFirstMember);

const blocks = sorted.flatMap((d) => writer.write(d));

const outputFile = path.resolve(__dirname, '../output/dota-api.lua');

fs.outputFile(
  outputFile,
  GENERATED_HEADER + '\n' + blocks.filter((b) => b.length > 0).join('\n\n') + '\n',
  'utf8',
)
  .then(() => {
    console.log(`Generated ${outputFile}`);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
