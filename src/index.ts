#!/usr/bin/env node
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
type PackageJsonDependencies = Record<string, string> | undefined;
type DependenciesMap = Record<string, DependencyEntry>;
interface PackageJson {
  name: string;
  version: string;
  dependencies: PackageJsonDependencies;
}
interface DependencyEntry {
  requiredTimes: number;
  circular: boolean;
  version: string;
  dependencies: Record<string, string>;
}
function getID(id: string, dependenciesMap: DependenciesMap) {
  return Object.entries(dependenciesMap).find(
    (e) => id == `${e[0]} (${e[1].version})`
  );
}
function hasCircularDependency(dependenciesMap: DependenciesMap) {
  const visited = new Set();
  function dfs(node: string) {
    if (visited.has(node)) {
      return true;
    }
    visited.add(node);
    if (dependenciesMap[node]) {
      const dependencies = dependenciesMap[node].dependencies;
      for (const dependency in dependencies) {
        if (dfs(dependency)) {
          return true;
        }
      }
      visited.delete(node);
    }
    return false;
  }
  for (const dependency in dependenciesMap) {
    if (dfs(dependency)) {
      return true;
    }
  }
  return false;
}
function checkCircularDependency(id: string, dependenciesMap: DependenciesMap) {
  const item = getID(id, dependenciesMap);
  const list: string[] = [];
  function check(dep: Record<string, string>): boolean {
    return (
      Object.entries(dep).findIndex((e) => {
        if (id == `${e[0]} (${e[1]})`) {
          return true;
        } else if (list.indexOf(`${e[0]} (${e[1]})`) != -1) {
          return false;
        } else {
          list.push(`${e[0]} (${e[1]})`);
          const next = getID(`${e[0]} (${e[1]})`, dependenciesMap);
          if (next) {
            return check(next[1].dependencies);
          }
        }
      }) != -1
    );
  }
  return item ? check(item[1].dependencies) : false;
}
function getRequiredTimes(id: string, dependenciesMap: DependenciesMap) {
  return Object.entries(dependenciesMap).filter(
    (e) =>
      Object.entries(e[1].dependencies).filter((f) => id == `${f[0]} (${f[1]})`)
        .length
  ).length;
}
function getDependenciesMap(
  depth: number | undefined,
  base: string
): DependenciesMap {
  if (!fs.existsSync(path.join(base, 'package.json'))) {
    throw 'Open package.json failed: File not found.';
  }
  const dependenciesMap: Record<string, DependencyEntry> = {};
  const packageJson = fs.readFileSync(path.join(base, 'package.json'), 'utf8');
  const packageData: PackageJson = JSON.parse(packageJson);
  const packageName = packageData.name || 'package.json';
  dependenciesMap[packageName] = {
    version: packageData.version,
    dependencies: packageData.dependencies || {},
    circular: false,
    requiredTimes: 0,
  };
  function saveDependencies(
    dependencies: PackageJsonDependencies,
    currentDepth: number | undefined
  ) {
    if (currentDepth !== undefined) {
      if (currentDepth === 0) return;
      currentDepth -= 1;
    }
    if (!dependencies) return;
    Object.entries(dependencies).forEach(([name, version]) => {
      if (!dependenciesMap[name]) {
        dependenciesMap[name] = {
          version: version,
          dependencies: {},
          circular: false,
          requiredTimes: 0,
        };
        const subPackageJsonPath = `./node_modules/${name}/package.json`;
        if (fs.existsSync(subPackageJsonPath)) {
          const subPackageJson = fs.readFileSync(subPackageJsonPath, 'utf8');
          const subPackageData = JSON.parse(subPackageJson);
          saveDependencies(subPackageData.dependencies, currentDepth);
          dependenciesMap[name].dependencies =
            subPackageData.dependencies || {};
        }
      }
    });
  }
  saveDependencies(packageData.dependencies, depth);
  return dependenciesMap;
}

function start(depth: number | undefined, base: string = '') {
  const map = getDependenciesMap(depth, base);
  const entries = Object.entries(map);
  entries.forEach((e) => {
    map[e[0]].circular = checkCircularDependency(
      `${e[0]} (${e[1].version})`,
      map
    );
    map[e[0]].requiredTimes = getRequiredTimes(
      `${e[0]} (${e[1].version})`,
      map
    );
  });
  return {
    name: entries[0][0],
    version: entries[0][1].version,
    count: entries.length,
    hasCircularDependency: hasCircularDependency(map),
    map,
  };
}

yargs(hideBin(process.argv))
  .usage('Usage: $0 <command> [options]')
  .option('depth', {
    description: 'Set depth',
    nargs: 1,
    type: 'number',
  })
  .option('json', {
    description: 'Save as JSON file',
    nargs: 1,
    type: 'string',
  })
  .demandCommand(1)
  .command('analyze', 'Start analyze', (yargs) => {
    //@ts-ignore
    const result = start(yargs.argv.depth);
    console.log(JSON.stringify(result));
    //@ts-ignore
    if (yargs.argv.json) {
      //@ts-ignore
      fs.writeFileSync(yargs.argv.json, JSON.stringify(result));
    }
  })
  .help(false)
  .version(false)
  .parse();
export { start };
