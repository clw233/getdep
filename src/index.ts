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
function getDependenciesMap(base: string, depth: number): DependenciesMap {
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
    currentDepth: number
  ) {
    if (currentDepth === 0) return;
    currentDepth -= 1;
    if (!dependencies) return;
    Object.entries(dependencies).forEach(([name, version]) => {
      if (!dependenciesMap[name]) {
        dependenciesMap[name] = {
          version: version,
          dependencies: {},
          circular: false,
          requiredTimes: 0,
        };
        const subPackageJsonPath = path.join(base, `./node_modules/${name}/package.json`);
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

function start(base: string = '', depth: number = -1) {
  const map = getDependenciesMap(base, depth);
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
    const result = start('', yargs.argv.depth);
    //@ts-ignore
    if (yargs.argv.json) {
      //@ts-ignore
      fs.writeFileSync(yargs.argv.json, JSON.stringify(result));
    } else {
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /><title>${`${result.name} ${result.version} - `}getdep</title><link href="https://unpkg.com/bootstrap@5.3.1/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-4bw+/aepP/YC94hEpVNVgiZdgIC5+VKNBQNGCHeKRQN+PtmoHDEXuppvnDJzQIu9" crossorigin="anonymous"><style>.card {margin:1em 0;}</style></head><body><div class="container-fluid"><div class="row"><div class="col-9"><div id="container" class="card" style="overflow:hidden"></div></div><div id="data" class="col-3"><noscript><div class="card border-warning"><div class="card-header text-bg-warning">启用 JavaScript</div><div class="card-body"><p class="card-text">如果没有 JavaScript，程序将不能正常运行。</p></div></div></noscript><div class="card"><div class="card-header">包信息</div><div class="card-body"><p class="card-text">名称：<span id="packagename"></span></p><p class="card-text">版本：<span id="packagever"></span></p><p class="card-text">依赖包总数：<span id="packagecount"></span></p><p class="card-text">循环依赖：<span id="packagecircular"></span></p></div></div><div class="card"><div class="card-header">依赖</div><div class="card-body"><p class="card-title">从图中选择一项来查看详情。</p><p class="card-text">名称：<span id="currentname"></span></p><p class="card-text">版本：<span id="currentver"></span></p><p class="card-text">被引用次数：<span id="currentrequire"></span></p><p class="card-text">循环依赖：<span id="currentcircular"></span></p></div></div><div class="card"><div class="card-header">功能</div><div class="card-body"><!-- Button trigger modal --><button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#staticBackdrop"onclick="updateTable()" id="checkDep" disabled>查看依赖信息</button><!-- Modal --><div class="modal fade" id="staticBackdrop" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1"aria-labelledby="staticBackdropLabel" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl"><div class="modal-content"><div class="modal-header"><h1 class="modal-title fs-5" id="staticBackdropLabel">正在查看依赖信息</h1><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><table class="table"><thead><tr><th>#</th><th>包名</th><th>依赖版本</th><th>实际版本</th></tr></thead><tbody id="depModalTable"></tbody></table></div></div></div></div></div></div></div></div></div><script src="https://gw.alipayobjects.com/os/lib/antv/g6/4.3.11/dist/g6.min.js"></script><script>const dependenciesData=${JSON.stringify(
        result
      )};const dependenciesMap=dependenciesData.map;const nodes=Object.entries(dependenciesMap).map((e) => ({id:e[0],label:${'`${e[0]} (${e[1].version})`'},}));const edges=Object.entries(dependenciesMap).map((e) =>Object.entries(e[1].dependencies).map((f) => {const obj={source:e[0],target:f[0]};if (f[1] != dependenciesMap[f[0]].version) {obj.color='red';}return obj;})).flat();const data={nodes,edges};var container=document.getElementById('container');var width=container.clientWidth;var height=window.innerHeight - 32;const graph=new G6.Graph({container:'container',width:width,height:height,defaultNode:{size:[80,80]},defaultEdge:{type:'line',style:{endArrow:true}},modes:{default:['drag-node','drag-canvas','zoom-canvas']},layout:{type:'dagre',nodesep:32,ranksep:32,controlPoints:true,},fitView:true,fitViewPadding:[20,20,20,20],});graph.on('node:click',(e) => {var item=dependenciesMap[e.item._cfg.id];document.getElementById('currentrequire').innerText =item.requiredTimes;document.getElementById('currentname').innerText=e.item._cfg.id;document.getElementById('currentver').innerText=item.version;document.getElementById('currentcircular').innerText=item.circular? '是':'否';document.getElementById('checkDep').disabled=false});graph.data(data);graph.render();document.getElementById('packagename').innerText=dependenciesData.name;document.getElementById('packagever').innerText =dependenciesData.version;document.getElementById('packagecount').innerText =dependenciesData.count;document.getElementById('packagecircular').innerText =dependenciesData.hasCircularDependency ? '有' :'无';function redraw() {var container=document.getElementById('container');var width=container.clientWidth;var height=800;graph.changeSize(width,height);graph.render();}function throttle(callback,delay) {let timer=null;return function () {if (timer) {return;}timer=setTimeout(function () {timer=null;callback.apply(this,arguments);},delay);};}var throttleRedraw=throttle(redraw,100);window.addEventListener('resize',throttleRedraw);function updateTable() {document.getElementById('staticBackdropLabel').innerText=${"`正在查看 ${document.getElementById('currentname').innerText} 的依赖信息`"};var array=Object.entries(dependenciesMap[document.getElementById('currentname').innerText].dependencies);var tbody=document.getElementById('depModalTable');tbody.innerHTML='';for (var i=0; i < array.length; i++) {var row=document.createElement("tr");var id=document.createElement("td");id.innerText=i+1;var name=document.createElement("td");name.innerText=array[i][0];var version=document.createElement("td");version.innerText=array[i][1];var requiredversion=document.createElement("td");requiredversion.innerText=dependenciesMap[array[i][0]].version;row.appendChild(id);row.appendChild(name);row.appendChild(version);row.appendChild(requiredversion);if (array[i][1] != dependenciesMap[array[i][0]].version) {row.classList.add('table-danger')}tbody.appendChild(row);}}</script><script src="https://unpkg.com/bootstrap@5.3.1/dist/js/bootstrap.bundle.min.js" integrity="sha384-HwwvtgBNo3bZJJLYd8oVXjrBZt8cqVSpeBNS5n7C8IVInixGAoxmnlMuBnhbgrkm" crossorigin="anonymous"></script></body></html>`;
      fs.writeFileSync('package.json.html', html);
      require('open-browsers')('http://localhost:3000');
      console.info(
        'See your browser for detail information.\nIf not opened automatically, please check package.json.html'
      );
    }
  })
  .help(false)
  .version(false)
  .parse();
export { start };
